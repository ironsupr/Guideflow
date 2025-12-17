/**
 * Capture Script - Injected into the target tab
 * 
 * This script runs in the context of the webpage and handles:
 * - getDisplayMedia (which shows all tabs/windows in picker)
 * - MediaRecorder for video/audio
 * - Uploading chunks to the server
 * - Showing a floating control bar
 */

(function() {
  // Prevent multiple injections
  if (window.__cluesoCaptureInjected) {
    console.log('Clueso capture already injected');
    return;
  }
  window.__cluesoCaptureInjected = true;
  
  console.log('🎬 Clueso capture script injected');
  
  // State
  let mediaStream = null;
  let mediaRecorder = null;
  let audioRecorder = null;
  let videoChunks = [];
  let audioChunks = [];
  let sessionId = null;
  let serverUrl = 'http://localhost:3000';
  let controlBar = null;
  let startTime = null;
  let durationInterval = null;
  let isPaused = false;
  
  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('🎬 Capture script received:', message.action);
    
    switch (message.action) {
      case 'START_RECORDING_IN_TAB':
        sessionId = message.sessionId;
        serverUrl = message.serverUrl || serverUrl;
        startCapture();
        sendResponse({ success: true });
        break;
        
      case 'STOP_RECORDING_IN_TAB':
        stopCapture();
        sendResponse({ success: true });
        break;
        
      case 'PAUSE_RECORDING_IN_TAB':
        pauseCapture();
        sendResponse({ success: true });
        break;
        
      case 'RESUME_RECORDING_IN_TAB':
        resumeCapture();
        sendResponse({ success: true });
        break;
    }
    
    return true;
  });
  
  /**
   * Start capturing - shows the native screen picker
   */
  async function startCapture() {
    try {
      console.log('🎬 Starting capture...');
      
      // Request screen capture - this shows the picker with ALL tabs/windows
      mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: true,
        preferCurrentTab: false, // Allow user to pick any tab
        selfBrowserSurface: 'include',
        surfaceSwitching: 'include',
        systemAudio: 'include',
      });
      
      console.log('🎬 Got media stream:', {
        video: mediaStream.getVideoTracks().length,
        audio: mediaStream.getAudioTracks().length,
      });
      
      // Setup video recorder
      const videoTracks = mediaStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const videoStream = new MediaStream(videoTracks);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';
        
        mediaRecorder = new MediaRecorder(videoStream, {
          mimeType,
          videoBitsPerSecond: 2500000,
        });
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            videoChunks.push(event.data);
            console.log('🎬 Video chunk:', event.data.size);
          }
        };
        
        mediaRecorder.onstop = async () => {
          console.log('🎬 Video recorder stopped, chunks:', videoChunks.length);
        };
        
        mediaRecorder.start(1000);
        console.log('🎬 Video recorder started');
      }
      
      // Setup audio recorder
      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioStream = new MediaStream(audioTracks);
        const audioMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        
        audioRecorder = new MediaRecorder(audioStream, {
          mimeType: audioMimeType,
          audioBitsPerSecond: 128000,
        });
        
        audioRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
            console.log('🎬 Audio chunk:', event.data.size);
          }
        };
        
        audioRecorder.onstop = async () => {
          console.log('🎬 Audio recorder stopped, chunks:', audioChunks.length);
        };
        
        audioRecorder.start(1000);
        console.log('🎬 Audio recorder started');
      } else {
        console.warn('🎬 No audio - user may not have checked "Share tab audio"');
      }
      
      // Handle stream ending
      mediaStream.getVideoTracks()[0].onended = () => {
        console.log('🎬 Screen sharing stopped by user');
        stopCapture();
      };
      
      // Show floating control bar
      startTime = Date.now();
      createControlBar();
      
    } catch (error) {
      console.error('🎬 Failed to start capture:', error);
      // Notify extension of failure
      chrome.runtime.sendMessage({
        action: 'CAPTURE_FAILED',
        error: error.message
      });
    }
  }
  
  /**
   * Stop capturing and upload
   */
  async function stopCapture() {
    try {
      console.log('🎬 Stopping capture...');
      
      // Stop recorders
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      if (audioRecorder && audioRecorder.state !== 'inactive') {
        audioRecorder.stop();
      }
      
      // Wait for final data
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Stop all tracks
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      
      // Remove control bar
      removeControlBar();
      
      console.log('🎬 Uploading - Video:', videoChunks.length, 'Audio:', audioChunks.length);
      
      // Upload video
      if (videoChunks.length > 0) {
        const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
        console.log('🎬 Uploading video, size:', videoBlob.size);
        await uploadChunk(videoBlob, 'video');
      }
      
      // Upload audio
      if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log('🎬 Uploading audio, size:', audioBlob.size);
        await uploadChunk(audioBlob, 'audio');
      }
      
      // Notify server to process
      await fetch(`${serverUrl}/api/recording/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      
      console.log('🎬 Recording saved and processing started');
      
      // Notify extension
      chrome.runtime.sendMessage({
        action: 'CAPTURE_COMPLETED',
        sessionId: sessionId
      });
      
      // Reset state
      resetState();
      
    } catch (error) {
      console.error('🎬 Failed to stop capture:', error);
    }
  }
  
  /**
   * Pause recording
   */
  function pauseCapture() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
    }
    if (audioRecorder && audioRecorder.state === 'recording') {
      audioRecorder.pause();
    }
    isPaused = true;
    updateControlBar();
  }
  
  /**
   * Resume recording
   */
  function resumeCapture() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
    }
    if (audioRecorder && audioRecorder.state === 'paused') {
      audioRecorder.resume();
    }
    isPaused = false;
    updateControlBar();
  }
  
  /**
   * Upload a chunk to the server
   */
  async function uploadChunk(blob, type) {
    const formData = new FormData();
    formData.append('chunk', blob, `${type}_0.webm`);
    formData.append('sessionId', sessionId);
    formData.append('chunkType', type);
    formData.append('chunkIndex', '0');
    formData.append('isLastChunk', 'true');
    
    const response = await fetch(`${serverUrl}/api/recording/chunk`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload ${type}`);
    }
    
    console.log(`🎬 ${type} uploaded successfully`);
  }
  
  /**
   * Reset state
   */
  function resetState() {
    mediaStream = null;
    mediaRecorder = null;
    audioRecorder = null;
    videoChunks = [];
    audioChunks = [];
    isPaused = false;
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  }
  
  /**
   * Create floating control bar
   */
  function createControlBar() {
    // Remove existing if any
    removeControlBar();
    
    controlBar = document.createElement('div');
    controlBar.id = 'clueso-control-bar';
    controlBar.innerHTML = `
      <style>
        #clueso-control-bar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 20px;
          border-radius: 50px;
          display: flex;
          align-items: center;
          gap: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          z-index: 2147483647;
          user-select: none;
        }
        #clueso-control-bar .recording-dot {
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          animation: clueso-pulse 1.5s ease-in-out infinite;
        }
        #clueso-control-bar .recording-dot.paused {
          background: #fbbf24;
          animation: none;
        }
        @keyframes clueso-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        #clueso-control-bar .duration {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          min-width: 50px;
        }
        #clueso-control-bar button {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: background 0.2s;
        }
        #clueso-control-bar button:hover {
          background: rgba(255,255,255,0.3);
        }
        #clueso-control-bar .btn-stop {
          background: #ef4444;
        }
        #clueso-control-bar .btn-stop:hover {
          background: #dc2626;
        }
      </style>
      <div class="recording-dot" id="clueso-dot"></div>
      <span class="duration" id="clueso-duration">00:00</span>
      <button id="clueso-pause" class="btn-pause">Pause</button>
      <button id="clueso-stop" class="btn-stop">Stop</button>
    `;
    
    document.body.appendChild(controlBar);
    
    // Add event listeners
    document.getElementById('clueso-pause').addEventListener('click', () => {
      if (isPaused) {
        resumeCapture();
      } else {
        pauseCapture();
      }
    });
    
    document.getElementById('clueso-stop').addEventListener('click', () => {
      stopCapture();
    });
    
    // Start duration timer
    durationInterval = setInterval(() => {
      if (startTime && !isPaused) {
        const elapsed = Date.now() - startTime;
        const seconds = Math.floor(elapsed / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        document.getElementById('clueso-duration').textContent = 
          `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }
  
  /**
   * Update control bar state
   */
  function updateControlBar() {
    const dot = document.getElementById('clueso-dot');
    const pauseBtn = document.getElementById('clueso-pause');
    
    if (dot) {
      dot.className = isPaused ? 'recording-dot paused' : 'recording-dot';
    }
    if (pauseBtn) {
      pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    }
  }
  
  /**
   * Remove control bar
   */
  function removeControlBar() {
    const existing = document.getElementById('clueso-control-bar');
    if (existing) {
      existing.remove();
    }
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  }
  
})();
