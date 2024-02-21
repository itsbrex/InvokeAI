import traceback
from contextlib import suppress
from threading import BoundedSemaphore, Thread
from threading import Event as ThreadEvent
from typing import Optional

from invokeai.app.invocations.baseinvocation import BaseInvocation
from invokeai.app.services.events.events_common import (
    BatchEnqueuedEvent,
    FastAPIEvent,
    InvocationCompleteEvent,
    InvocationErrorEvent,
    InvocationStartedEvent,
    QueueClearedEvent,
    QueueEvent,
    SessionCanceledEvent,
    SessionCompleteEvent,
    SessionStartedEvent,
    register_events,
)
from invokeai.app.services.invocation_stats.invocation_stats_common import GESStatsNotFoundError
from invokeai.app.services.session_processor.session_processor_common import CanceledException
from invokeai.app.services.session_queue.session_queue_common import SessionQueueItem
from invokeai.app.services.shared.invocation_context import InvocationContextData, build_invocation_context
from invokeai.app.util.profiler import Profiler

from ..invoker import Invoker
from .session_processor_base import SessionProcessorBase
from .session_processor_common import SessionProcessorStatus


class DefaultSessionProcessor(SessionProcessorBase):
    def start(self, invoker: Invoker, thread_limit: int = 1, polling_interval: int = 1) -> None:
        self._invoker: Invoker = invoker
        self._queue_item: Optional[SessionQueueItem] = None
        self._invocation: Optional[BaseInvocation] = None

        self._resume_event = ThreadEvent()
        self._stop_event = ThreadEvent()
        self._poll_now_event = ThreadEvent()
        self._cancel_event = ThreadEvent()

        self._thread_limit = thread_limit
        self._thread_semaphore = BoundedSemaphore(thread_limit)
        self._polling_interval = polling_interval

        # If profiling is enabled, create a profiler. The same profiler will be used for all sessions. Internally,
        # the profiler will create a new profile for each session.
        self._profiler = (
            Profiler(
                logger=self._invoker.services.logger,
                output_dir=self._invoker.services.configuration.profiles_path,
                prefix=self._invoker.services.configuration.profile_prefix,
            )
            if self._invoker.services.configuration.profile_graphs
            else None
        )

        register_events([SessionCanceledEvent, QueueClearedEvent, BatchEnqueuedEvent], self._on_queue_event)

        self._thread = Thread(
            name="session_processor",
            target=self._process,
            kwargs={
                "stop_event": self._stop_event,
                "poll_now_event": self._poll_now_event,
                "resume_event": self._resume_event,
                "cancel_event": self._cancel_event,
            },
        )
        self._thread.start()

    def stop(self, *args, **kwargs) -> None:
        self._stop_event.set()

    def _poll_now(self) -> None:
        self._poll_now_event.set()

    async def _on_queue_event(self, event: FastAPIEvent[QueueEvent]) -> None:
        _event_name, payload = event
        if isinstance(payload, (SessionCanceledEvent, QueueClearedEvent)):
            # These both mean we should cancel the current session.
            self._cancel_event.set()
            self._poll_now()
        elif isinstance(payload, BatchEnqueuedEvent):
            self._poll_now()

    def resume(self) -> SessionProcessorStatus:
        if not self._resume_event.is_set():
            self._resume_event.set()
        return self.get_status()

    def pause(self) -> SessionProcessorStatus:
        if self._resume_event.is_set():
            self._resume_event.clear()
        return self.get_status()

    def get_status(self) -> SessionProcessorStatus:
        return SessionProcessorStatus(
            is_started=self._resume_event.is_set(),
            is_processing=self._queue_item is not None,
        )

    def _process(
        self,
        stop_event: ThreadEvent,
        poll_now_event: ThreadEvent,
        resume_event: ThreadEvent,
        cancel_event: ThreadEvent,
    ):
        # Outermost processor try block; any unhandled exception is a fatal processor error
        try:
            self._thread_semaphore.acquire()
            stop_event.clear()
            resume_event.set()
            cancel_event.clear()

            while not stop_event.is_set():
                poll_now_event.clear()
                # Middle processor try block; any unhandled exception is a non-fatal processor error
                try:
                    # Get the next session to process
                    self._queue_item = self._invoker.services.session_queue.dequeue()
                    if self._queue_item is not None and resume_event.is_set():
                        # Dispatch session started event
                        self._invoker.services.events.dispatch(SessionStartedEvent.build(queue_item=self._queue_item))
                        self._invoker.services.logger.debug(f"Executing queue item {self._queue_item.item_id}")
                        cancel_event.clear()

                        # If profiling is enabled, start the profiler
                        if self._profiler is not None:
                            self._profiler.start(profile_id=self._queue_item.session_id)

                        # Prepare invocations and take the first
                        self._invocation = self._queue_item.session.next()

                        # Loop over invocations until the session is complete or canceled
                        while self._invocation is not None and not cancel_event.is_set():
                            # get the source node id to provide to clients (the prepared node id is not as useful)
                            source_invocation_id = self._queue_item.session.prepared_source_mapping[self._invocation.id]

                            # Dispatch invocation started event
                            self._invoker.services.events.dispatch(
                                InvocationStartedEvent.build(queue_item=self._queue_item, invocation=self._invocation)
                            )

                            # Innermost processor try block; any unhandled exception is an invocation error & will fail the graph
                            try:
                                with self._invoker.services.performance_statistics.collect_stats(
                                    self._invocation, self._queue_item.session.id
                                ):
                                    # Build invocation context (the node-facing API)
                                    data = InvocationContextData(
                                        invocation=self._invocation,
                                        source_invocation_id=source_invocation_id,
                                        queue_item=self._queue_item,
                                    )
                                    context = build_invocation_context(
                                        data=data,
                                        services=self._invoker.services,
                                        cancel_event=self._cancel_event,
                                    )

                                    # Invoke the node
                                    outputs = self._invocation.invoke_internal(
                                        context=context, services=self._invoker.services
                                    )

                                    # Save outputs and history
                                    self._queue_item.session.complete(self._invocation.id, outputs)

                                    # Dispatch invocation complete event
                                    self._invoker.services.events.dispatch(
                                        InvocationCompleteEvent.build(
                                            queue_item=self._queue_item, invocation=self._invocation, result=outputs
                                        )
                                    )

                            except KeyboardInterrupt:
                                # TODO(MM2): I don't think this is ever raised...
                                pass

                            except CanceledException:
                                # When the user cancels the graph, we first set the cancel event. The event is checked
                                # between invocations, in this loop. Some invocations are long-running, and we need to
                                # be able to cancel them mid-execution.
                                #
                                # For example, denoising is a long-running invocation with many steps. A step callback
                                # is executed after each step. This step callback checks if the canceled event is set,
                                # then raises a CanceledException to stop execution immediately.
                                #
                                # When we get a CanceledException, we don't need to do anything - just pass and let the
                                # loop go to its next iteration, and the cancel event will be handled correctly.
                                pass

                            except Exception as e:
                                error = traceback.format_exc()

                                # Save error
                                self._queue_item.session.set_node_error(self._invocation.id, error)
                                self._invoker.services.logger.error(
                                    f"Error while invoking session {self._queue_item.session_id}, invocation {self._invocation.id} ({self._invocation.get_type()}):\n{e}"
                                )

                                # Dispatch invocation error event
                                self._invoker.services.events.dispatch(
                                    InvocationErrorEvent.build(
                                        queue_item=self._queue_item,
                                        invocation=self._invocation,
                                        error_type=e.__class__.__name__,
                                        error=error,
                                    )
                                )
                                pass

                            # The session is complete if the all invocations are complete or there was an error
                            if self._queue_item.session.is_complete() or cancel_event.is_set():
                                # Dispatch session complete event
                                self._invoker.services.events.dispatch(
                                    SessionCompleteEvent.build(queue_item=self._queue_item)
                                )
                                # If we are profiling, stop the profiler and dump the profile & stats
                                if self._profiler:
                                    profile_path = self._profiler.stop()
                                    stats_path = profile_path.with_suffix(".json")
                                    self._invoker.services.performance_statistics.dump_stats(
                                        graph_execution_state_id=self._queue_item.session.id, output_path=stats_path
                                    )
                                # We'll get a GESStatsNotFoundError if we try to log stats for an untracked graph, but in the processor
                                # we don't care about that - suppress the error.
                                with suppress(GESStatsNotFoundError):
                                    self._invoker.services.performance_statistics.log_stats(self._queue_item.session.id)
                                    self._invoker.services.performance_statistics.reset_stats()

                                # Set the invocation to None to prepare for the next session
                                self._invocation = None
                            else:
                                # Prepare the next invocation
                                self._invocation = self._queue_item.session.next()

                        # The session is complete, immediately poll for next session
                        self._queue_item = None
                        poll_now_event.set()
                    else:
                        # The queue was empty, wait for next polling interval or event to try again
                        self._invoker.services.logger.debug("Waiting for next polling interval or event")
                        poll_now_event.wait(self._polling_interval)
                        continue
                except Exception:
                    # Non-fatal error in processor
                    self._invoker.services.logger.error(
                        f"Non-fatal error in session processor:\n{traceback.format_exc()}"
                    )
                    # Cancel the queue item
                    if self._queue_item is not None:
                        self._invoker.services.session_queue.cancel_queue_item(
                            self._queue_item.item_id, error=traceback.format_exc()
                        )
                    # Reset the invocation to None to prepare for the next session
                    self._invocation = None
                    # Immediately poll for next queue item
                    poll_now_event.wait(self._polling_interval)
                    continue
        except Exception:
            # Fatal error in processor, log and pass - we're done here
            self._invoker.services.logger.error(f"Fatal Error in session processor:\n{traceback.format_exc()}")
            pass
        finally:
            stop_event.clear()
            poll_now_event.clear()
            self._queue_item = None
            self._thread_semaphore.release()
