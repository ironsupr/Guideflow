import { DOMEvent } from './events';
import { SessionStatus, TranscriptionResult, RefinedScript } from './session';

/**
 * API Request/Response Types
 */

// Extension -> Node.js
export interface UploadChunkRequest {
  sessionId: string;
  chunkIndex: number;
  chunkType: 'video' | 'audio';
  isLastChunk: boolean;
}

export interface SaveEventsRequest {
  sessionId: string;
  events: DOMEvent[];
  url: string;
  viewport: { width: number; height: number };
}

export interface StartRecordingRequest {
  url: string;
  viewport: { width: number; height: number };
}

export interface StartRecordingResponse {
  sessionId: string;
  status: 'started';
}

export interface StopRecordingRequest {
  sessionId: string;
}

export interface StopRecordingResponse {
  sessionId: string;
  status: 'processing';
  message: string;
}

// Node.js -> Python FastAPI
export interface AudioProcessRequest {
  sessionId: string;
  audioPath: string;
  rawTranscript: string;
  domEvents: DOMEvent[];
  targetLanguage?: string;
}

export interface AudioProcessResponse {
  sessionId: string;
  refinedText: string;
  synthesizedAudioPath: string;
  instructions: Array<{
    text: string;
    startTime: number;
    endTime: number;
  }>;
}

// WebSocket Events (Node.js -> Frontend)
export interface SocketEvents {
  // Server -> Client
  session_started: { sessionId: string };
  session_status: { sessionId: string; status: SessionStatus; message?: string };
  transcription_ready: { sessionId: string; transcription: TranscriptionResult };
  refinement_ready: { sessionId: string; refinedScript: RefinedScript };
  synthesis_ready: { sessionId: string; audioPath: string };
  session_complete: { sessionId: string };
  error: { sessionId: string; error: string };
  
  // Client -> Server
  subscribe_session: { sessionId: string };
  unsubscribe_session: { sessionId: string };
  get_sessions: void;
}

// API Responses
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SessionListResponse {
  sessions: Array<{
    sessionId: string;
    title?: string;
    duration?: number;
    status: SessionStatus;
    createdAt: string;
    thumbnailPath?: string;
  }>;
}
