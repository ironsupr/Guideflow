import { Server as SocketIOServer, Socket } from 'socket.io';
import { SessionManager } from '../services/SessionManager';

/**
 * Setup Socket.IO event handlers for real-time communication
 */
export function setupSocketHandlers(io: SocketIOServer): void {
  const sessionManager = new SessionManager();

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Subscribe to session updates
    socket.on('subscribe_session', async ({ sessionId }) => {
      socket.join(`session:${sessionId}`);
      console.log(`📺 Client ${socket.id} subscribed to session: ${sessionId}`);

      // Send current session state
      const session = await sessionManager.getSession(sessionId);
      if (session) {
        socket.emit('session_status', {
          sessionId,
          status: session.status,
          message: 'Subscribed to session updates',
        });
      }
    });

    // Unsubscribe from session updates
    socket.on('unsubscribe_session', ({ sessionId }) => {
      socket.leave(`session:${sessionId}`);
      console.log(`📺 Client ${socket.id} unsubscribed from session: ${sessionId}`);
    });

    // Get all sessions
    socket.on('get_sessions', async () => {
      const sessions = await sessionManager.listSessions();
      socket.emit('sessions_list', {
        sessions: sessions.map((s) => ({
          sessionId: s.sessionId,
          url: s.url,
          status: s.status,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: s.endTime ? s.endTime - s.startTime : null,
        })),
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  // Middleware for logging
  io.use((socket, next) => {
    const origin = socket.handshake.headers.origin;
    console.log(`🔍 Socket connection attempt from: ${origin}`);
    next();
  });
}
