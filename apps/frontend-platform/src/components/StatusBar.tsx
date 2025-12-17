'use client';

import { Circle, Wifi, WifiOff } from 'lucide-react';

interface StatusBarProps {
  isConnected: boolean;
  currentStatus: string;
}

export function StatusBar({ isConnected, currentStatus }: StatusBarProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Processing Status */}
      {currentStatus && (
        <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-full text-sm">
          <Circle className="w-2 h-2 animate-pulse" fill="currentColor" />
          <span className="max-w-48 truncate">{currentStatus}</span>
        </div>
      )}
      
      {/* Connection Status */}
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
          isConnected
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}
      >
        {isConnected ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Disconnected</span>
          </>
        )}
      </div>
    </div>
  );
}
