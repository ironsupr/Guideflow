'use client';

import { Trash2, Clock, Circle } from 'lucide-react';

interface Session {
  sessionId: string;
  url: string;
  status: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  eventsCount?: number;
}

interface SessionListProps {
  sessions: Session[];
  selectedId?: string;
  onSelect: (session: Session) => void;
  onDelete: (sessionId: string) => void;
  loading: boolean;
}

const statusColors: Record<string, string> = {
  recording: 'bg-red-500',
  processing: 'bg-yellow-500',
  transcribing: 'bg-blue-500',
  refining: 'bg-purple-500',
  synthesizing: 'bg-indigo-500',
  completed: 'bg-green-500',
  error: 'bg-red-600',
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

export function SessionList({
  sessions,
  selectedId,
  onSelect,
  onDelete,
  loading,
}: SessionListProps) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg h-20"
          />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-sm">No recordings yet</p>
        <p className="text-xs mt-1">Use the Chrome extension to start recording</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[calc(100vh-300px)] overflow-y-auto">
      {sessions.map((session) => (
        <div
          key={session.sessionId}
          onClick={() => onSelect(session)}
          className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
            selectedId === session.sessionId
              ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-primary-500'
              : ''
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* URL/Domain */}
              <p className="font-medium text-gray-900 dark:text-white truncate text-sm">
                {extractDomain(session.url)}
              </p>
              
              {/* Status indicator */}
              <div className="flex items-center gap-2 mt-1">
                <Circle
                  className={`w-2 h-2 ${statusColors[session.status] || 'bg-gray-400'} rounded-full`}
                  fill="currentColor"
                />
                <span className="text-xs text-gray-500 capitalize">
                  {session.status}
                </span>
              </div>
              
              {/* Meta info */}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {session.duration
                    ? formatDuration(session.duration)
                    : formatDate(session.startTime)}
                </span>
                {session.eventsCount !== undefined && (
                  <span>{session.eventsCount} events</span>
                )}
              </div>
            </div>
            
            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.sessionId);
              }}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
