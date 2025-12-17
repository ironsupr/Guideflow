import { Server as SocketIOServer } from 'socket.io';
import { SessionManager } from './SessionManager';
import { DeepgramService } from './DeepgramService';
import { PythonClient } from './PythonClient';

interface SessionData {
  sessionId: string;
  audioPath?: string;
  events: any[];
  [key: string]: any;
}

/**
 * ProcessingPipeline - Orchestrates the full processing workflow
 * 
 * Flow:
 * 1. Transcribe audio (Deepgram)
 * 2. Refine text (Gemini via Python)
 * 3. Synthesize voice (ElevenLabs via Python)
 * 4. Update session and notify clients
 */
export class ProcessingPipeline {
  private io: SocketIOServer;
  private sessionManager: SessionManager;
  private deepgram: DeepgramService;
  private pythonClient: PythonClient;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.sessionManager = new SessionManager();
    this.deepgram = new DeepgramService();
    this.pythonClient = new PythonClient();
  }

  /**
   * Emit status update to connected clients
   */
  private emitStatus(sessionId: string, status: string, message?: string): void {
    this.io.emit('session_status', { sessionId, status, message });
    console.log(`📡 [${sessionId}] ${status}: ${message || ''}`);
  }

  /**
   * Process a completed recording session
   */
  async process(session: SessionData): Promise<void> {
    const { sessionId } = session;

    try {
      // Step 1: Transcribe audio
      this.emitStatus(sessionId, 'transcribing', 'Transcribing audio with Deepgram...');
      
      let transcription = { rawText: '', words: [], confidence: 0, duration: 0 };
      
      if (session.audioPath && this.deepgram.isConfigured()) {
        transcription = await this.deepgram.transcribeFile(session.audioPath);
        
        // Save transcription to session
        await this.sessionManager.updateSession(sessionId, {
          transcription,
          status: 'transcribing',
        });

        this.io.emit('transcription_ready', {
          sessionId,
          transcription,
        });
      } else if (!this.deepgram.isConfigured()) {
        console.warn('⚠️  Deepgram not configured, skipping transcription');
        this.emitStatus(sessionId, 'transcribing', 'Deepgram not configured, skipping...');
      }

      // Step 2: Check Python service health
      const pythonHealthy = await this.pythonClient.healthCheck();
      
      if (!pythonHealthy) {
        console.warn('⚠️  Python service not available, skipping AI processing');
        this.emitStatus(sessionId, 'completed', 'Processing complete (AI services unavailable)');
        
        await this.sessionManager.updateSession(sessionId, {
          status: 'completed',
          processedAt: new Date().toISOString(),
        });
        
        this.io.emit('session_complete', { sessionId });
        return;
      }

      // Step 3: Refine text and synthesize voice via Python service
      this.emitStatus(sessionId, 'refining', 'Refining script with Gemini AI...');

      const processResult = await this.pythonClient.processAudio({
        sessionId,
        audioPath: session.audioPath || '',
        rawTranscript: transcription.rawText,
        domEvents: session.events || [],
      });

      // Save refined script
      await this.sessionManager.updateSession(sessionId, {
        refinedScript: {
          originalText: transcription.rawText,
          refinedText: processResult.refinedText,
          instructions: processResult.instructions,
        },
        status: 'synthesizing',
      });

      this.io.emit('refinement_ready', {
        sessionId,
        refinedScript: {
          originalText: transcription.rawText,
          refinedText: processResult.refinedText,
          instructions: processResult.instructions,
        },
      });

      // Step 4: Update with synthesized audio
      this.emitStatus(sessionId, 'synthesizing', 'Generating AI voiceover with ElevenLabs...');

      await this.sessionManager.updateSession(sessionId, {
        synthesizedAudioPath: processResult.synthesizedAudioPath,
        status: 'completed',
        processedAt: new Date().toISOString(),
      });

      this.io.emit('synthesis_ready', {
        sessionId,
        audioPath: processResult.synthesizedAudioPath,
      });

      // Step 5: Complete
      this.emitStatus(sessionId, 'completed', 'Processing complete!');
      this.io.emit('session_complete', { sessionId });

    } catch (error) {
      console.error(`❌ Processing failed for ${sessionId}:`, error);
      
      await this.sessionManager.updateSession(sessionId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.io.emit('error', {
        sessionId,
        error: error instanceof Error ? error.message : 'Processing failed',
      });
    }
  }
}
