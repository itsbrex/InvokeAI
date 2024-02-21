import type { Graph, GraphExecutionState, S } from 'services/api/types';

export type AnyInvocation = NonNullable<NonNullable<Graph['nodes']>[string]>;

export type AnyResult = NonNullable<GraphExecutionState['results'][string]>;

export type BaseNode = {
  id: string;
  type: string;
  [key: string]: AnyInvocation[keyof AnyInvocation];
};

export type ModelLoadStartedEvent = S['ModelLoadStartedEvent'];
export type ModelLoadCompleteEvent = S['ModelLoadCompleteEvent'];

export type InvocationStartedEvent = S['InvocationStartedEvent'];
export type InvocationDenoiseProgressEvent = S['InvocationDenoiseProgressEvent'];
export type InvocationCompleteEvent = Omit<S['InvocationCompleteEvent'], 'result'> & { result: AnyResult };
export type InvocationErrorEvent = S['InvocationErrorEvent'];
export type ProgressImage = InvocationDenoiseProgressEvent['progress_image'];

export type SessionCompleteEvent = S['SessionCompleteEvent'];
export type SessionCanceledEvent = S['SessionCanceledEvent'];

export type QueueItemStatusChangedEvent = S['QueueItemStatusChangedEvent'];

export type ClientEmitSubscribeQueue = {
  queue_id: string;
};

export type ClientEmitUnsubscribeQueue = ClientEmitSubscribeQueue;

export type BulkDownloadStartedEvent = S['BulkDownloadStartedEvent'];
export type BulkDownloadCompleteEvent = S['BulkDownloadCompleteEvent'];
export type BulkDownloadFailedEvent = S['BulkDownloadErrorEvent'];

export type ClientEmitSubscribeBulkDownload = {
  bulk_download_id: string;
};

export type ClientEmitUnsubscribeBulkDownload = {
  bulk_download_id: string;
};

export type ServerToClientEvents = {
  invocation_denoise_progress: (payload: InvocationDenoiseProgressEvent) => void;
  invocation_complete: (payload: InvocationCompleteEvent) => void;
  invocation_error: (payload: InvocationErrorEvent) => void;
  invocation_started: (payload: InvocationStartedEvent) => void;
  session_complete: (payload: SessionCompleteEvent) => void;
  model_load_started: (payload: ModelLoadStartedEvent) => void;
  model_load_complete: (payload: ModelLoadCompleteEvent) => void;
  queue_item_status_changed: (payload: QueueItemStatusChangedEvent) => void;
  bulk_download_started: (payload: BulkDownloadStartedEvent) => void;
  bulk_download_complete: (payload: BulkDownloadCompleteEvent) => void;
  bulk_download_error: (payload: BulkDownloadFailedEvent) => void;
};

export type ClientToServerEvents = {
  connect: () => void;
  disconnect: () => void;
  subscribe_queue: (payload: ClientEmitSubscribeQueue) => void;
  unsubscribe_queue: (payload: ClientEmitUnsubscribeQueue) => void;
  subscribe_bulk_download: (payload: ClientEmitSubscribeBulkDownload) => void;
  unsubscribe_bulk_download: (payload: ClientEmitUnsubscribeBulkDownload) => void;
};
