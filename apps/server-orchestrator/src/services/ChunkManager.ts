import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { config } from '../config';

interface ChunkInfo {
  index: number;
  type: 'video' | 'audio';
  path: string;
  size: number;
}

interface SessionChunks {
  video: ChunkInfo[];
  audio: ChunkInfo[];
}

/**
 * ChunkManager - Handles media chunk aggregation and merging
 */
export class ChunkManager {
  private chunksMap: Map<string, SessionChunks> = new Map();

  /**
   * Ensure session directory exists
   */
  async ensureSessionDir(sessionId: string): Promise<string> {
    const sessionDir = path.join(config.recordingsDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    return sessionDir;
  }

  /**
   * Add a chunk to tracking
   */
  async addChunk(sessionId: string, chunk: ChunkInfo): Promise<void> {
    if (!this.chunksMap.has(sessionId)) {
      this.chunksMap.set(sessionId, { video: [], audio: [] });
    }
    
    const sessionChunks = this.chunksMap.get(sessionId)!;
    sessionChunks[chunk.type].push(chunk);
    
    // Sort by index
    sessionChunks[chunk.type].sort((a, b) => a.index - b.index);
  }

  /**
   * Merge all chunks of a type into a single file
   */
  async mergeChunks(sessionId: string, type: 'video' | 'audio'): Promise<string> {
    const sessionChunks = this.chunksMap.get(sessionId);
    
    if (!sessionChunks || sessionChunks[type].length === 0) {
      throw new Error(`No ${type} chunks found for session ${sessionId}`);
    }
    
    const chunks = sessionChunks[type];
    const sessionDir = path.join(config.recordingsDir, sessionId);
    const outputPath = path.join(sessionDir, `recording_${type}.webm`);
    
    // If only one chunk, just rename it
    if (chunks.length === 1) {
      await fs.rename(chunks[0].path, outputPath);
      return outputPath;
    }
    
    // Merge multiple chunks by concatenating
    const writeStream = createWriteStream(outputPath);
    
    for (const chunk of chunks) {
      await new Promise<void>((resolve, reject) => {
        const readStream = createReadStream(chunk.path);
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', resolve);
        readStream.on('error', reject);
      });
      
      // Delete the chunk file after merging
      await fs.unlink(chunk.path).catch(() => {});
    }
    
    writeStream.end();
    
    // Clear chunks from memory
    sessionChunks[type] = [];
    
    return outputPath;
  }

  /**
   * Save events to a JSON file
   */
  async saveEventsFile(sessionId: string, events: any[]): Promise<string> {
    const sessionDir = path.join(config.recordingsDir, sessionId);
    const eventsPath = path.join(sessionDir, 'dom_events.json');
    
    await fs.writeFile(eventsPath, JSON.stringify({
      sessionId,
      events,
      savedAt: new Date().toISOString(),
    }, null, 2));
    
    return eventsPath;
  }

  /**
   * Get paths for a session's files
   */
  async getSessionFiles(sessionId: string): Promise<{
    videoPath?: string;
    audioPath?: string;
    eventsPath?: string;
  }> {
    const sessionDir = path.join(config.recordingsDir, sessionId);
    const result: { videoPath?: string; audioPath?: string; eventsPath?: string } = {};
    
    const files = await fs.readdir(sessionDir).catch(() => []);
    
    for (const file of files) {
      const filePath = path.join(sessionDir, file);
      if (file.includes('video') && file.endsWith('.webm')) {
        result.videoPath = filePath;
      } else if (file.includes('audio') && file.endsWith('.webm')) {
        result.audioPath = filePath;
      } else if (file === 'dom_events.json') {
        result.eventsPath = filePath;
      }
    }
    
    return result;
  }
}
