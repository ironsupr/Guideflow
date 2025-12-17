'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  Video,
  RotateCcw,
  Settings,
  MousePointer
} from 'lucide-react';

interface Session {
  sessionId: string;
  videoPath?: string;
  audioPath?: string;
  synthesizedAudioPath?: string;
  events?: any[];
  refinedScript?: {
    instructions: any[];
  };
}

interface VideoPlayerProps {
  session: Session;
  onTimeUpdate: (time: number) => void;
}

export function VideoPlayer({ session, onTimeUpdate }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const volumeRef = useRef<HTMLInputElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [useSynthesizedAudio, setUseSynthesizedAudio] = useState(true);

  // Determine which media URL to use
  const getMediaUrl = useCallback(() => {
    // Always use video when available, regardless of audio selection
    if (session.videoPath) {
      return `http://localhost:3000/recordings/${session.sessionId}/recording_video.webm`;
    }

    // If no video, use synthesized audio if selected
    if (useSynthesizedAudio && session.synthesizedAudioPath) {
      return `http://localhost:8000${session.synthesizedAudioPath}`;
    }

    // Otherwise use original audio
    if (session.audioPath) {
      return `http://localhost:3000/recordings/${session.sessionId}/recording_audio.webm`;
    }

    return null;
  }, [session, useSynthesizedAudio]);

  const mediaUrl = getMediaUrl();
  const hasVideo = !!session.videoPath;
  const hasAudio = !!(session.audioPath || session.synthesizedAudioPath);
  const isUsingSynthesizedAudio = useSynthesizedAudio && !!session.synthesizedAudioPath;

  // Initialize video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      setIsLoading(false);
      setError('Failed to load media');
    };
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Mute video when using synthesized audio
    video.muted = isUsingSynthesizedAudio;

    // Load the media
    video.src = mediaUrl;
    video.load();

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [mediaUrl, isUsingSynthesizedAudio]);

  // Initialize audio element for synthesized audio
  useEffect(() => {
    const audio = audioRef.current;

    if (isUsingSynthesizedAudio && session.synthesizedAudioPath && audio) {
      const audioUrl = `http://localhost:8000${session.synthesizedAudioPath}`;

      const handleAudioError = () => {
        console.error('Failed to load synthesized audio');
      };

      audio.addEventListener('error', handleAudioError);
      audio.src = audioUrl;
      audio.load();

      return () => {
        audio.removeEventListener('error', handleAudioError);
      };
    }
  }, [isUsingSynthesizedAudio, session.synthesizedAudioPath]);

  // Time update and event highlighting
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      onTimeUpdate(time);

      // Update active events for highlighting
      if (session.events && session.events.length > 0) {
        const currentTimeMs = time * 1000;
        const baseTime = session.events[0]?.timestamp || 0;

        const events = session.events.filter((event) => {
          const eventTime = event.timestamp - baseTime;
          return eventTime >= currentTimeMs - 1000 && eventTime <= currentTimeMs + 1000;
        });

        setActiveEvents(events);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [session.events, onTimeUpdate]);

  // Auto-hide controls
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(timer);
  }, [isPlaying, showControls]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Control functions
  const togglePlay = async () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    try {
      if (isPlaying) {
        video.pause();
        if (audio && isUsingSynthesizedAudio) {
          audio.pause();
        }
      } else {
        await video.play();
        if (audio && isUsingSynthesizedAudio) {
          await audio.play();
        }
      }
    } catch (error) {
      console.error('Playback error:', error);
      setError('Playback failed');
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);

    if (audio && isUsingSynthesizedAudio) {
      audio.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    const vol = parseFloat(e.target.value);
    video.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);

    if (audio && isUsingSynthesizedAudio) {
      audio.volume = vol;
      audio.muted = vol === 0;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    const newMuted = !isMuted;
    video.muted = newMuted;
    setIsMuted(newMuted);

    if (audio && isUsingSynthesizedAudio) {
      audio.muted = newMuted;
    }
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, duration));

    if (audio && isUsingSynthesizedAudio) {
      audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const restart = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    video.currentTime = 0;
    setCurrentTime(0);
    setActiveEvents([]);

    if (audio && isUsingSynthesizedAudio) {
      audio.currentTime = 0;
    }
  };

  // Format time display
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // No media available
  if (!mediaUrl) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-96 flex items-center justify-center">
        <div className="text-center text-gray-500 p-6">
          <Video className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No media recorded</p>
          <p className="text-sm mt-2 text-gray-400">
            The recording was not captured. Make sure the Chrome extension has permissions and try recording again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-black rounded-lg overflow-hidden relative group"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <div className="relative aspect-video bg-black">
        {hasVideo || isUsingSynthesizedAudio ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              preload="metadata"
            />
            {/* Hidden audio element for synthesized audio */}
            {isUsingSynthesizedAudio && (
              <audio
                ref={audioRef}
                preload="metadata"
                style={{ display: 'none' }}
              />
            )}
          </>
        ) : (
          // Audio-only visualization
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
            <div className="text-center text-white">
              <Volume2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Audio Recording</p>
              <p className="text-sm opacity-70">No video captured</p>
            </div>
          </div>
        )}

        {/* Event Highlights Overlay */}
        {hasVideo && activeEvents.map((event, index) => {
          if (!event.target?.bbox) return null;

          const { x, y, width, height } = event.target.bbox;
          const viewport = event.metadata?.viewport || { width: 1920, height: 1080 };

          // Scale to video dimensions
          const scaleX = 100 / viewport.width;
          const scaleY = 100 / viewport.height;

          return (
            <div
              key={`${event.timestamp}-${index}`}
              className="absolute border-2 border-red-500 bg-red-500/20 rounded animate-pulse pointer-events-none"
              style={{
                left: `${x * scaleX}%`,
                top: `${y * scaleY}%`,
                width: `${width * scaleX}%`,
                height: `${height * scaleY}%`,
              }}
            >
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <MousePointer className="w-4 h-4 text-red-500 bg-black rounded-full p-1" />
              </div>
            </div>
          );
        })}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  const video = videoRef.current;
                  if (video) {
                    video.load();
                  }
                }}
                className="mt-4 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress Bar */}
        <div className="mb-4">
          <input
            ref={progressRef}
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-white/80 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={restart}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Restart"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => skip(-10)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Skip back 10s"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              className="p-3 bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>

            <button
              onClick={() => skip(10)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Skip forward 10s"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Audio Source Toggle */}
            {(session.audioPath && session.synthesizedAudioPath) && (
              <button
                onClick={() => setUseSynthesizedAudio(!useSynthesizedAudio)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  useSynthesizedAudio
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                title={`Switch to ${useSynthesizedAudio ? 'original' : 'AI'} audio`}
              >
                {useSynthesizedAudio ? 'AI Voice' : 'Original'}
              </button>
            )}

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <input
                ref={volumeRef}
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                title="Volume"
              />
            </div>

            {/* Settings */}
            <button
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Click to show controls when hidden */}
      {!showControls && isPlaying && (
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={() => setShowControls(true)}
        />
      )}
    </div>
  );
}
