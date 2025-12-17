import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { SessionManager } from '../services/SessionManager';
import { ChunkManager } from '../services/ChunkManager';
import { ProcessingPipeline } from '../services/ProcessingPipeline';

// Configure multer for chunk uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.body.sessionId || 'unknown';
    const sessionDir = path.join(config.recordingsDir, sessionId);
    // Ensure directory exists synchronously
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    const chunkIndex = req.body.chunkIndex || 0;
    const chunkType = req.body.chunkType || 'unknown';
    cb(null, `chunk_${chunkType}_${chunkIndex}.webm`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per chunk
});

export function recordingRouter(io: SocketIOServer): Router {
  const router = Router();
  const sessionManager = new SessionManager();
  const chunkManager = new ChunkManager();
  const pipeline = new ProcessingPipeline(io);

  /**
   * POST /api/recording/start
   * Initialize a new recording session
   */
  router.post('/start', async (req: Request, res: Response) => {
    try {
      const { url, viewport } = req.body;
      
      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
      }
      
      const sessionId = `session_${Date.now()}_${uuidv4().slice(0, 8)}`;
      
      // Create session
      await sessionManager.createSession({
        sessionId,
        url,
        viewport: viewport || { width: 1920, height: 1080 },
        startTime: Date.now(),
        events: [],
        status: 'recording',
      });
      
      // Ensure session directory exists
      await chunkManager.ensureSessionDir(sessionId);
      
      // Notify clients
      io.emit('session_started', { sessionId });
      
      res.json({
        success: true,
        data: { sessionId, status: 'started' },
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      res.status(500).json({ success: false, error: 'Failed to start recording' });
    }
  });

  /**
   * POST /api/recording/chunk
   * Upload a media chunk (video or audio)
   */
  router.post('/chunk', upload.single('chunk'), async (req: Request, res: Response) => {
    try {
      const { sessionId, chunkIndex, chunkType, isLastChunk } = req.body;
      
      if (!sessionId || !req.file) {
        return res.status(400).json({ success: false, error: 'Missing sessionId or chunk' });
      }
      
      // Track chunk
      await chunkManager.addChunk(sessionId, {
        index: parseInt(chunkIndex, 10),
        type: chunkType as 'video' | 'audio',
        path: req.file.path,
        size: req.file.size,
      });
      
      // If last chunk, merge all chunks
      if (isLastChunk === 'true' || isLastChunk === true) {
        const mergedPath = await chunkManager.mergeChunks(sessionId, chunkType);
        
        // Update session with file path
        if (chunkType === 'video') {
          await sessionManager.updateSession(sessionId, { videoPath: mergedPath });
        } else if (chunkType === 'audio') {
          await sessionManager.updateSession(sessionId, { audioPath: mergedPath });
        }
      }
      
      res.json({
        success: true,
        data: {
          sessionId,
          chunkIndex,
          chunkType,
          received: true,
        },
      });
    } catch (error) {
      console.error('Error uploading chunk:', error);
      res.status(500).json({ success: false, error: 'Failed to upload chunk' });
    }
  });

  /**
   * POST /api/recording/events
   * Save DOM events for a session
   */
  router.post('/events', async (req: Request, res: Response) => {
    try {
      const { sessionId, events, url, viewport } = req.body;
      
      if (!sessionId || !events) {
        return res.status(400).json({ success: false, error: 'Missing sessionId or events' });
      }
      
      // Append events to session
      await sessionManager.appendEvents(sessionId, events);
      
      // Also save as JSON file for backup
      await chunkManager.saveEventsFile(sessionId, events);
      
      res.json({
        success: true,
        data: {
          sessionId,
          eventsCount: events.length,
        },
      });
    } catch (error) {
      console.error('Error saving events:', error);
      res.status(500).json({ success: false, error: 'Failed to save events' });
    }
  });

  /**
   * POST /api/recording/stop
   * Stop recording and trigger the processing pipeline
   */
  router.post('/stop', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'Missing sessionId' });
      }
      
      // Update session end time
      await sessionManager.updateSession(sessionId, {
        endTime: Date.now(),
        status: 'processing',
      });
      
      // Get session data
      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      // Notify clients
      io.emit('session_status', {
        sessionId,
        status: 'processing',
        message: 'Recording stopped, starting processing...',
      });
      
      // Trigger async processing pipeline
      pipeline.process(session).catch((error) => {
        console.error('Processing pipeline error:', error);
        io.emit('error', { sessionId, error: error.message });
      });
      
      res.json({
        success: true,
        data: {
          sessionId,
          status: 'processing',
          message: 'Recording stopped. Processing started.',
        },
      });
    } catch (error) {
      console.error('Error stopping recording:', error);
      res.status(500).json({ success: false, error: 'Failed to stop recording' });
    }
  });

  return router;
}
