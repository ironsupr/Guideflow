'use client';

import { Clock, MousePointer, Scroll, Keyboard, Type, AlertCircle, Video, Volume2, FileText, Zap } from 'lucide-react';

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
  transcription?: {
    rawText: string;
    words?: any[];
    confidence?: number;
    duration?: number;
  };
  refinedScript?: {
    originalText: string;
    refinedText: string;
    instructions: any[];
  };
  error?: string;
}

interface SessionDetailsProps {
  session: Session;
}

const eventIcons: Record<string, any> = {
  click: MousePointer,
  scroll: Scroll,
  keydown: Keyboard,
  input: Type,
  focus: Zap,
  blur: Zap,
};

function formatTime(timestamp: number, baseTime: number): string {
  const ms = timestamp - baseTime;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function SessionDetails({ session }: SessionDetailsProps) {
  const events = session.events || [];
  const baseTime = events[0]?.timestamp || session.startTime;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Session Details</h3>
        <p className="text-xs text-gray-500 mt-1 truncate">{session.url}</p>
      </div>
      
      {/* Status Cards */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {/* Video Status */}
        <div className={`p-3 rounded-lg ${session.videoPath ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
          <div className="flex items-center gap-2">
            <Video className={`w-4 h-4 ${session.videoPath ? 'text-green-600' : 'text-yellow-600'}`} />
            <span className="text-xs font-medium">Video</span>
          </div>
          <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
            {session.videoPath ? '✓ Available' : '✗ Not recorded'}
          </p>
        </div>
        
        {/* Audio Status */}
        <div className={`p-3 rounded-lg ${session.audioPath ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
          <div className="flex items-center gap-2">
            <Volume2 className={`w-4 h-4 ${session.audioPath ? 'text-green-600' : 'text-yellow-600'}`} />
            <span className="text-xs font-medium">Audio</span>
          </div>
          <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
            {session.audioPath ? '✓ Available' : '✗ Not recorded'}
          </p>
        </div>
        
        {/* Transcript Status */}
        <div className={`p-3 rounded-lg ${session.transcription?.rawText ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
          <div className="flex items-center gap-2">
            <FileText className={`w-4 h-4 ${session.transcription?.rawText ? 'text-green-600' : 'text-gray-400'}`} />
            <span className="text-xs font-medium">Transcript</span>
          </div>
          <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
            {session.transcription?.rawText ? '✓ Transcribed' : 'Not available'}
          </p>
        </div>
        
        {/* Events Status */}
        <div className={`p-3 rounded-lg ${events.length > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
          <div className="flex items-center gap-2">
            <MousePointer className={`w-4 h-4 ${events.length > 0 ? 'text-green-600' : 'text-yellow-600'}`} />
            <span className="text-xs font-medium">DOM Events</span>
          </div>
          <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
            {events.length > 0 ? `${events.length} captured` : 'None captured'}
          </p>
        </div>
      </div>
      
      {/* Error Message */}
      {session.error && (
        <div className="mx-4 mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Error</span>
          </div>
          <p className="text-xs mt-1 text-red-600">{session.error}</p>
        </div>
      )}
      
      {/* Refined Script Preview */}
      {session.refinedScript?.refinedText && (
        <div className="mx-4 mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">AI Script</h4>
          <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
              {session.refinedScript.refinedText || 'No refined script available'}
            </p>
          </div>
        </div>
      )}
      
      {/* Events Timeline */}
      {events.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Events Timeline</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {events.slice(0, 20).map((event, index) => {
                const Icon = eventIcons[event.type] || MousePointer;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 text-xs"
                  >
                    <div className="flex items-center gap-1 text-gray-500 w-12">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(event.timestamp, baseTime)}</span>
                    </div>
                    <Icon className="w-4 h-4 text-primary-500" />
                    <div className="flex-1 truncate">
                      <span className="font-medium capitalize">{event.type}</span>
                      {event.target && (
                        <span className="text-gray-500 ml-2">
                          on {event.target.tag?.toLowerCase()}
                          {event.target.id && `#${event.target.id}`}
                          {event.target.text && ` "${event.target.text.slice(0, 20)}..."`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {events.length > 20 && (
                <p className="text-center text-xs text-gray-500 py-2">
                  +{events.length - 20} more events
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Session Metadata */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Metadata</h4>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-gray-500">Session ID</dt>
            <dd className="text-gray-700 dark:text-gray-300 truncate">{session.sessionId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="text-gray-700 dark:text-gray-300 capitalize">{session.status}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Started</dt>
            <dd className="text-gray-700 dark:text-gray-300">{formatDate(session.startTime)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Duration</dt>
            <dd className="text-gray-700 dark:text-gray-300">
              {session.endTime 
                ? `${Math.round((session.endTime - session.startTime) / 1000)}s`
                : 'N/A'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
