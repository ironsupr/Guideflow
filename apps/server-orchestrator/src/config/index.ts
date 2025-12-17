import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Deepgram
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  
  // Python Service
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  
  // File Storage
  recordingsDir: path.resolve(process.env.RECORDINGS_DIR || './recordings'),
  sessionsFile: path.resolve(process.env.SESSIONS_FILE || './data/sessions.json'),
  
  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3001').split(','),
};

// Validate required config
export function validateConfig(): void {
  const requiredKeys: (keyof typeof config)[] = ['deepgramApiKey'];
  const missing: string[] = [];
  
  for (const key of requiredKeys) {
    if (!config[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0 && config.nodeEnv === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (missing.length > 0) {
    console.warn(`⚠️  Warning: Missing environment variables: ${missing.join(', ')}`);
  }
}
