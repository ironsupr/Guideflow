import { Express } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { recordingRouter } from './recording';
import { sessionRouter } from './session';

export function setupRoutes(app: Express, io: SocketIOServer): void {
  // Recording routes (chunk upload, events)
  app.use('/api/recording', recordingRouter(io));
  
  // Session routes (list, get, delete)
  app.use('/api/sessions', sessionRouter(io));
  
  // API info
  app.get('/api', (req, res) => {
    res.json({
      name: 'Clueso.io Clone - Server Orchestrator',
      version: '1.0.0',
      endpoints: {
        recording: {
          'POST /api/recording/start': 'Start a new recording session',
          'POST /api/recording/chunk': 'Upload a media chunk (multipart)',
          'POST /api/recording/events': 'Save DOM events',
          'POST /api/recording/stop': 'Stop recording and trigger processing',
        },
        sessions: {
          'GET /api/sessions': 'List all sessions',
          'GET /api/sessions/:id': 'Get session details',
          'DELETE /api/sessions/:id': 'Delete a session',
        },
      },
    });
  });
}
