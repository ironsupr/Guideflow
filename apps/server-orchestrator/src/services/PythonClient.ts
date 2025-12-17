import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

interface AudioProcessRequest {
  sessionId: string;
  audioPath: string;
  rawTranscript: string;
  domEvents: any[];
  targetLanguage?: string;
}

interface Instruction {
  text: string;
  startTime: number;
  endTime: number;
}

interface AudioProcessResponse {
  sessionId: string;
  refinedText: string;
  synthesizedAudioPath: string;
  instructions: Instruction[];
}

interface HealthCheckResponse {
  status: string;
  timestamp: string;
}

/**
 * PythonClient - Axios wrapper for communicating with FastAPI service
 */
export class PythonClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.pythonServiceUrl,
      timeout: 120000, // 2 minutes for AI processing
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check if Python service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get<HealthCheckResponse>('/health');
      return response.data.status === 'ok';
    } catch (error) {
      console.warn('Python service health check failed:', error);
      return false;
    }
  }

  /**
   * Process audio with AI refinement and TTS synthesis
   */
  async processAudio(request: AudioProcessRequest): Promise<AudioProcessResponse> {
    console.log(`🐍 Sending to Python service: ${request.sessionId}`);

    const response = await this.client.post<AudioProcessResponse>(
      '/audio-full-process',
      request
    );

    return response.data;
  }

  /**
   * Refine transcript text using Gemini (without TTS)
   */
  async refineText(rawTranscript: string, domEvents: any[]): Promise<{
    refinedText: string;
    instructions: Instruction[];
  }> {
    const response = await this.client.post('/refine-text', {
      rawTranscript,
      domEvents,
    });

    return response.data;
  }

  /**
   * Generate voice from text using ElevenLabs
   */
  async synthesizeVoice(text: string, voiceId?: string): Promise<{
    audioPath: string;
    duration: number;
  }> {
    const response = await this.client.post('/synthesize-voice', {
      text,
      voiceId,
    });

    return response.data;
  }

  /**
   * Translate and synthesize in a different language
   */
  async translateAndSynthesize(
    text: string,
    targetLanguage: string,
    voiceId?: string
  ): Promise<{
    translatedText: string;
    audioPath: string;
    duration: number;
  }> {
    const response = await this.client.post('/translate-synthesize', {
      text,
      targetLanguage,
      voiceId,
    });

    return response.data;
  }
}
