import { DOMEvent, Viewport } from './events';

/**
 * Recording Session Types
 */

export type SessionStatus = 
  | 'recording' 
  | 'processing' 
  | 'transcribing' 
  | 'refining' 
  | 'synthesizing' 
  | 'completed' 
  | 'error';

export interface RecordingSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  url: string;
  viewport: Viewport;
  events: DOMEvent[];
  videoPath?: string;
  audioPath?: string;
  processedAt?: string;
  status: SessionStatus;
}

export interface SessionMetadata {
  sessionId: string;
  title?: string;
  description?: string;
  duration?: number;
  thumbnailPath?: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
}

export interface TranscriptionResult {
  rawText: string;
  words: TranscriptionWord[];
  confidence: number;
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface RefinedScript {
  originalText: string;
  refinedText: string;
  instructions: Instruction[];
}

export interface Instruction {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  associatedEventIndex?: number;
  highlight?: {
    selector: string;
    bbox: { x: number; y: number; width: number; height: number };
  };
}

export interface ProcessedSession extends RecordingSession {
  transcription?: TranscriptionResult;
  refinedScript?: RefinedScript;
  synthesizedAudioPath?: string;
}
