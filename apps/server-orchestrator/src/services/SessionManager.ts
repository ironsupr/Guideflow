import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

interface SessionData {
  sessionId: string;
  url: string;
  viewport: { width: number; height: number };
  startTime: number;
  endTime?: number;
  events: any[];
  videoPath?: string;
  audioPath?: string;
  status: string;
  title?: string;
  description?: string;
  transcription?: any;
  refinedScript?: any;
  synthesizedAudioPath?: string;
  processedAt?: string;
}

interface SessionsStore {
  sessions: Record<string, SessionData>;
  lastUpdated: string;
}

/**
 * SessionManager - Handles session CRUD operations using JSON file storage
 */
export class SessionManager {
  private sessionsPath: string;

  constructor() {
    this.sessionsPath = config.sessionsFile;
  }

  /**
   * Load sessions from JSON file
   */
  private async loadSessions(): Promise<SessionsStore> {
    try {
      const data = await fs.readFile(this.sessionsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist yet, return empty store
      return { sessions: {}, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Save sessions to JSON file
   */
  private async saveSessions(store: SessionsStore): Promise<void> {
    store.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.sessionsPath, JSON.stringify(store, null, 2), 'utf-8');
  }

  /**
   * Create a new session
   */
  async createSession(session: SessionData): Promise<SessionData> {
    const store = await this.loadSessions();
    store.sessions[session.sessionId] = session;
    await this.saveSessions(store);
    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const store = await this.loadSessions();
    return store.sessions[sessionId] || null;
  }

  /**
   * Update a session
   */
  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<SessionData | null> {
    const store = await this.loadSessions();
    
    if (!store.sessions[sessionId]) {
      return null;
    }
    
    store.sessions[sessionId] = {
      ...store.sessions[sessionId],
      ...updates,
    };
    
    await this.saveSessions(store);
    return store.sessions[sessionId];
  }

  /**
   * Append events to a session
   */
  async appendEvents(sessionId: string, events: any[]): Promise<void> {
    const store = await this.loadSessions();
    
    if (!store.sessions[sessionId]) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    store.sessions[sessionId].events = [
      ...(store.sessions[sessionId].events || []),
      ...events,
    ];
    
    await this.saveSessions(store);
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<SessionData[]> {
    const store = await this.loadSessions();
    return Object.values(store.sessions).sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const store = await this.loadSessions();
    
    if (!store.sessions[sessionId]) {
      return false;
    }
    
    // Delete session files
    const sessionDir = path.join(config.recordingsDir, sessionId);
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Could not delete session directory: ${sessionDir}`);
    }
    
    delete store.sessions[sessionId];
    await this.saveSessions(store);
    
    return true;
  }
}
