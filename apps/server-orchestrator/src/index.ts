import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config, validateConfig } from './config';
import { setupRoutes } from './routes';
import { setupSocketHandlers } from './socket';
import { ensureDirectories } from './utils/storage';

async function main() {
  // Validate configuration
  validateConfig();
  
  // Ensure storage directories exist
  await ensureDirectories();
  
  // Create Express app
  const app = express();
  
  // Middleware
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Static files for recordings
  app.use('/recordings', express.static(config.recordingsDir));
  
  // Create HTTP server
  const server = http.createServer(app);
  
  // Setup Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: 50 * 1024 * 1024, // 50MB for large chunks
  });
  
  // Setup routes
  setupRoutes(app, io);
  
  // Setup socket handlers
  setupSocketHandlers(io);
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Start server
  server.listen(config.port, () => {
    console.log(`
🚀 Server Orchestrator running!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 HTTP:   http://localhost:${config.port}
🔌 Socket: ws://localhost:${config.port}
📁 Recordings: ${config.recordingsDir}
🐍 Python API: ${config.pythonServiceUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
