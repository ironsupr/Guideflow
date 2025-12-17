import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { SessionManager } from '../services/SessionManager';

export function sessionRouter(io: SocketIOServer): Router {
  const router = Router();
  const sessionManager = new SessionManager();

  /**
   * GET /api/sessions
   * List all recording sessions
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const sessions = await sessionManager.listSessions();
      
      res.json({
        success: true,
        data: {
          sessions: sessions.map((s) => ({
            sessionId: s.sessionId,
            url: s.url,
            status: s.status,
            startTime: s.startTime,
            endTime: s.endTime,
            duration: s.endTime ? s.endTime - s.startTime : null,
            eventsCount: s.events?.length || 0,
          })),
        },
      });
    } catch (error) {
      console.error('Error listing sessions:', error);
      res.status(500).json({ success: false, error: 'Failed to list sessions' });
    }
  });

  /**
   * GET /api/sessions/:id
   * Get a specific session with full details
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const session = await sessionManager.getSession(id);
      
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ success: false, error: 'Failed to get session' });
    }
  });

  /**
   * DELETE /api/sessions/:id
   * Delete a session and its files
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const deleted = await sessionManager.deleteSession(id);
      
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      // Notify clients
      io.emit('session_deleted', { sessionId: id });
      
      res.json({
        success: true,
        data: { sessionId: id, deleted: true },
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ success: false, error: 'Failed to delete session' });
    }
  });

  /**
   * PATCH /api/sessions/:id
   * Update session metadata (title, description)
   */
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { title, description } = req.body;
      
      const session = await sessionManager.updateSession(id, {
        ...(title && { title }),
        ...(description && { description }),
      });
      
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({ success: false, error: 'Failed to update session' });
    }
  });

  return router;
}
