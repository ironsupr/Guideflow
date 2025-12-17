import { createClient, DeepgramClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import fs from 'fs/promises';
import { config } from '../config';

interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

interface TranscriptionResult {
  rawText: string;
  words: TranscriptionWord[];
  confidence: number;
  duration: number;
}

/**
 * DeepgramService - Handles Speech-to-Text transcription
 */
export class DeepgramService {
  private client: DeepgramClient | null = null;

  constructor() {
    if (config.deepgramApiKey) {
      this.client = createClient(config.deepgramApiKey);
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Transcribe an audio file
   */
  async transcribeFile(audioPath: string): Promise<TranscriptionResult> {
    if (!this.client) {
      throw new Error('Deepgram API key not configured');
    }

    console.log(`📝 Transcribing audio: ${audioPath}`);

    // Read the audio file
    const audioBuffer = await fs.readFile(audioPath);

    // Send to Deepgram
    const { result, error } = await this.client.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        utterances: true,
        diarize: false,
      }
    );

    if (error) {
      throw new Error(`Deepgram transcription failed: ${error.message}`);
    }

    // Extract words and text
    const channel = result.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];

    if (!alternative) {
      return {
        rawText: '',
        words: [],
        confidence: 0,
        duration: 0,
      };
    }

    const words: TranscriptionWord[] = (alternative.words || []).map((w: any) => ({
      word: w.word,
      start: w.start,
      end: w.end,
      confidence: w.confidence,
    }));

    const duration = result.metadata?.duration || 0;

    return {
      rawText: alternative.transcript || '',
      words,
      confidence: alternative.confidence || 0,
      duration,
    };
  }

  /**
   * Create a live transcription stream (for real-time transcription)
   */
  async createLiveStream(onTranscript: (text: string, isFinal: boolean) => void): Promise<{
    send: (data: Buffer) => void;
    close: () => void;
  }> {
    if (!this.client) {
      throw new Error('Deepgram API key not configured');
    }

    const connection = this.client.listen.live({
      model: 'nova-2',
      smart_format: true,
      punctuate: true,
      interim_results: true,
      endpointing: 300,
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      if (transcript) {
        onTranscript(transcript, data.is_final || false);
      }
    });

    connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('Deepgram live error:', error);
    });

    return {
      send: (data: Buffer) => connection.send(data),
      close: () => connection.finish(),
    };
  }
}
