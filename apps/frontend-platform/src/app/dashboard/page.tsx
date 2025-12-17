'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { SessionList } from '@/components/SessionList';
import { VideoPlayer } from '@/components/VideoPlayer';
import { InstructionEditor } from '@/components/InstructionEditor';
import { SessionDetails } from '@/components/SessionDetails';
import { StatusBar } from '@/components/StatusBar';
import { Video, List, Settings, Info } from 'lucide-react';

interface Session {
  sessionId: string;
  url: string;
  status: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  eventsCount?: number;
  videoPath?: string;
  audioPath?: string;
  synthesizedAudioPath?: string;
  events?: any[];
  refinedScript?: {
    originalText: string;
    refinedText: string;
    instructions: any[];
  };
}

export default function Home() {
  const { socket, isConnected } = useSocket('http://localhost:3000');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('sessions_list', ({ sessions }) => {
      setSessions(sessions);
      setLoading(false);
    });

    socket.on('session_status', ({ sessionId, status, message }) => {
      setCurrentStatus(`${status}: ${message || ''}`);
      
      // Update session status in list
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? { ...s, status } : s))
      );
    });

    socket.on('session_complete', ({ sessionId }) => {
      setCurrentStatus('');
      // Refresh session details
      fetchSessionDetails(sessionId);
    });

    socket.on('session_started', ({ sessionId }) => {
      fetchSessions();
    });

    socket.emit('get_sessions');

    return () => {
      socket.off('sessions_list');
      socket.off('session_status');
      socket.off('session_complete');
      socket.off('session_started');
    };
  }, [socket]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/sessions');
      const data = await res.json();
      if (data.success) {
        setSessions(data.data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionDetails = async (sessionId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/sessions/${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedSession(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch session details:', error);
    }
  };

  const handleSelectSession = (session: Session) => {
    fetchSessionDetails(session.sessionId);
    
    // Subscribe to updates for this session
    if (socket) {
      socket.emit('subscribe_session', { sessionId: session.sessionId });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await fetch(`http://localhost:3000/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      if (selectedSession?.sessionId === sessionId) {
        setSelectedSession(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Video className="w-8 h-8 text-primary-500" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Clueso.io Clone
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  AI-Powered Tutorial Generator
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <StatusBar isConnected={isConnected} currentStatus={currentStatus} />
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Settings className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Session List - Left Sidebar */}
          <div className="col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <List className="w-5 h-5 text-gray-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Recordings
                  </h2>
                </div>
              </div>
              <SessionList
                sessions={sessions}
                selectedId={selectedSession?.sessionId}
                onSelect={handleSelectSession}
                onDelete={handleDeleteSession}
                loading={loading}
              />
            </div>
          </div>

          {/* Video Player - Main Area */}
          <div className="col-span-6">
            {selectedSession ? (
              <VideoPlayer
                session={selectedSession}
                onTimeUpdate={() => {}}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-96 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a recording to view</p>
                </div>
              </div>
            )}
          </div>

          {/* Instruction Editor - Right Sidebar */}
          <div className="col-span-3 space-y-4">
            {/* Session Details Panel */}
            {selectedSession && (
              <SessionDetails session={selectedSession} />
            )}
            
            {/* Instructions Editor */}
            {selectedSession && selectedSession.refinedScript && selectedSession.refinedScript.instructions && selectedSession.refinedScript.instructions.length > 0 ? (
              <InstructionEditor
                script={selectedSession.refinedScript}
                onUpdate={(updated) => {
                  setSelectedSession({
                    ...selectedSession,
                    refinedScript: updated,
                  });
                }}
              />
            ) : (
              !selectedSession && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-48 flex items-center justify-center">
                  <div className="text-center text-gray-500 p-4">
                    <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      Select a recording to view details and instructions.
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
