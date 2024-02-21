import { $baseUrl } from 'app/store/nanostores/baseUrl';
import { $bulkDownloadId } from 'app/store/nanostores/bulkDownloadId';
import { $queueId } from 'app/store/nanostores/queueId';
import type { AppDispatch } from 'app/store/store';
import { addToast } from 'features/system/store/systemSlice';
import { makeToast } from 'features/system/util/makeToast';
import {
  socketBulkDownloadComplete,
  socketBulkDownloadError,
  socketBulkDownloadStarted,
  socketConnected,
  socketDisconnected,
  socketGeneratorProgress,
  socketGraphExecutionStateComplete,
  socketInvocationComplete,
  socketInvocationError,
  socketInvocationStarted,
  socketModelLoadCompleted,
  socketModelLoadStarted,
  socketQueueItemStatusChanged,
} from 'services/events/actions';
import type { ClientToServerEvents, ServerToClientEvents } from 'services/events/types';
import type { Socket } from 'socket.io-client';

type SetEventListenersArg = {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  dispatch: AppDispatch;
};

export const setEventListeners = (arg: SetEventListenersArg) => {
  const { socket, dispatch } = arg;

  /**
   * Connect
   */
  socket.on('connect', () => {
    dispatch(socketConnected());
    const queue_id = $queueId.get();
    socket.emit('subscribe_queue', { queue_id });
    if (!$baseUrl.get()) {
      const bulk_download_id = $bulkDownloadId.get();
      socket.emit('subscribe_bulk_download', { bulk_download_id });
    }
  });

  socket.on('connect_error', (error) => {
    if (error && error.message) {
      const data: string | undefined = (error as unknown as { data: string | undefined }).data;
      if (data === 'ERR_UNAUTHENTICATED') {
        dispatch(
          addToast(
            makeToast({
              title: error.message,
              status: 'error',
              duration: 10000,
            })
          )
        );
      }
    }
  });

  socket.on('disconnect', () => {
    dispatch(socketDisconnected());
  });
  socket.on('invocation_started', (data) => {
    dispatch(socketInvocationStarted({ data }));
  });

  socket.on('invocation_denoise_progress', (data) => {
    dispatch(socketGeneratorProgress({ data }));
  });

  socket.on('invocation_error', (data) => {
    dispatch(socketInvocationError({ data }));
  });

  socket.on('invocation_complete', (data) => {
    dispatch(
      socketInvocationComplete({
        data,
      })
    );
  });

  socket.on('session_complete', (data) => {
    dispatch(
      socketGraphExecutionStateComplete({
        data,
      })
    );
  });

  socket.on('model_load_started', (data) => {
    dispatch(
      socketModelLoadStarted({
        data,
      })
    );
  });

  socket.on('model_load_complete', (data) => {
    dispatch(
      socketModelLoadCompleted({
        data,
      })
    );
  });

  socket.on('queue_item_status_changed', (data) => {
    dispatch(socketQueueItemStatusChanged({ data }));
  });

  socket.on('bulk_download_started', (data) => {
    dispatch(socketBulkDownloadStarted({ data }));
  });

  socket.on('bulk_download_complete', (data) => {
    dispatch(socketBulkDownloadComplete({ data }));
  });

  socket.on('bulk_download_error', (data) => {
    dispatch(socketBulkDownloadError({ data }));
  });
};
