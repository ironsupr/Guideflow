import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

/**
 * Ensure required directories exist
 */
export async function ensureDirectories(): Promise<void> {
  // Recordings directory
  await fs.mkdir(config.recordingsDir, { recursive: true });
  console.log(`📁 Recordings directory: ${config.recordingsDir}`);

  // Data directory for sessions.json
  const dataDir = path.dirname(config.sessionsFile);
  await fs.mkdir(dataDir, { recursive: true });
  console.log(`📁 Data directory: ${dataDir}`);

  // Initialize sessions file if it doesn't exist
  try {
    await fs.access(config.sessionsFile);
  } catch {
    await fs.writeFile(
      config.sessionsFile,
      JSON.stringify({ sessions: {}, lastUpdated: new Date().toISOString() }, null, 2)
    );
    console.log(`📝 Created sessions file: ${config.sessionsFile}`);
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `session_${timestamp}_${random}`;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
