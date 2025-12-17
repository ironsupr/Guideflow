/**
 * Recorder Window Script
 * 
 * This runs in a dedicated popup window that stays open during recording.
 * Since it's a separate window, it survives page navigation in the target tab.
 */

const SERVER_URL = 'http://localhost:3000';

// State
let mediaStream = null;
let mediaRecorder = null;
let audioRecorder = null;
let videoChunks = [];
let audioChunks = [];
let sessionId = null;
let startTime = null;
let durationInterval = null;
let isPaused = false;

// DOM elements
const dot = document.getElementById('dot');
const status = document.getElementById('status');
const duration = document.getElementById('duration');
const errorDiv = document.getElementById('error');
const controlsReady = document.getElementById('controls-ready');
const controlsRecording = document.getElementById('controls-recording');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');

// Get session info from URL params
const urlParams = new URLSearchParams(window.location.search);
sessionId = urlParams.get('sessionId');
const targetUrl = urlParams.get('url') || 'Unknown page';

console.log('Recorder window opened for session:', sessionId);

// Event listeners
btnStart.addEventListener('click', startRecording);
btnPause.addEventListener('click', togglePause);
btnStop.addEventListener('click', stopRecording);

// Handle window close
window.addEventListener('beforeunload', (e) => {
  if (mediaStream) {
    // Recording in progress
    e.preventDefault();
    e.returnValue = 'Recording in progress. Are you sure you want to close?';
  }
});

/**
 * Start recording
 */
async function startRecording() {
  try {
    btnStart.disabled = true;
    btnStart.textContent = 'Starting...';
    hideError();
    
    // Create session if we don't have one
    if (!sessionId) {
      const response = await fetch(`${SERVER_URL}/api/recording/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          viewport: { width: 1920, height: 1080 },
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create session');
      }
      sessionId = data.data.sessionId;
    }
    
    console.log('Session:', sessionId);
    
    // Request screen capture - this window shows ALL tabs/windows in picker
    console.log('Requesting screen capture...');
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: true,
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude', // Don't show this recorder window
      surfaceSwitching: 'include',
      systemAudio: 'include',
    });
    
    console.log('Got media stream:', {
      video: mediaStream.getVideoTracks().length,
      audio: mediaStream.getAudioTracks().length,
    });
    
    // Check what surface was selected
    const videoTrack = mediaStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    console.log('Recording:', settings.displaySurface || 'screen');
    
    // Setup video recorder
    if (mediaStream.getVideoTracks().length > 0) {
      const videoStream = new MediaStream(mediaStream.getVideoTracks());
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
          console.log('Video chunk:', videoChunks.length, 'size:', event.data.size);
        }
      };
      
      mediaRecorder.onerror = (e) => {
        console.error('Video recorder error:', e);
        showError('Video recording error');
      };
      
      mediaRecorder.start(1000);
      console.log('Video recorder started');
    }
    
    // Setup audio recorder
    if (mediaStream.getAudioTracks().length > 0) {
      const audioStream = new MediaStream(mediaStream.getAudioTracks());
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
          console.log('Audio chunk:', audioChunks.length, 'size:', event.data.size);
        }
      };
      
      audioRecorder.start(1000);
      console.log('Audio recorder started');
    } else {
      console.warn('No audio track - user may not have checked "Share audio"');
      status.textContent = 'Recording (no audio)';
    }
    
    // Handle stream ending (user clicks browser's "Stop sharing")
    mediaStream.getVideoTracks()[0].onended = () => {
      console.log('Stream ended by user');
      stopRecording();
    };
    
    // Update UI
    startTime = Date.now();
    showRecordingUI();
    startDurationTimer();
    
    // Notify extension
    chrome.runtime.sendMessage({ 
      action: 'RECORDING_STARTED',
      sessionId: sessionId 
    });
    
  } catch (error) {
    console.error('Failed to start recording:', error);
    showError(error.message);
    showReadyUI();
  }
}

/**
 * Toggle pause/resume
 */
function togglePause() {
  if (isPaused) {
    // Resume
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
    }
    if (audioRecorder && audioRecorder.state === 'paused') {
      audioRecorder.resume();
    }
    isPaused = false;
    dot.className = 'recording-dot';
    status.textContent = 'Recording...';
    btnPause.textContent = '⏸ Pause';
  } else {
    // Pause
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
    }
    if (audioRecorder && audioRecorder.state === 'recording') {
      audioRecorder.pause();
    }
    isPaused = true;
    dot.className = 'recording-dot paused';
    status.textContent = 'Paused';
    btnPause.textContent = '▶ Resume';
  }
}

/**
 * Stop recording and upload
 */
async function stopRecording() {
  try {
    btnStop.disabled = true;
    btnStop.textContent = 'Saving...';
    status.textContent = 'Saving recording...';
    
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
    
    // Stop timer
    if (durationInterval) {
      clearInterval(durationInterval);
    }
    
    console.log('Uploading - Video chunks:', videoChunks.length, 'Audio chunks:', audioChunks.length);
    
    // Upload video
    if (videoChunks.length > 0) {
      const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
      console.log('Uploading video, size:', videoBlob.size);
      status.textContent = 'Uploading video...';
      await uploadChunk(videoBlob, 'video');
    }
    
    // Upload audio
    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('Uploading audio, size:', audioBlob.size);
      status.textContent = 'Uploading audio...';
      await uploadChunk(audioBlob, 'audio');
    }
    
    // Notify server to process
    status.textContent = 'Processing...';
    await fetch(`${SERVER_URL}/api/recording/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    
    console.log('Recording saved!');
    
    // Notify extension
    chrome.runtime.sendMessage({ 
      action: 'RECORDING_COMPLETED',
      sessionId: sessionId 
    });
    
    // Show success and close
    status.textContent = '✓ Saved! Closing...';
    dot.className = 'recording-dot ready';
    
    // Close window after a short delay
    setTimeout(() => {
      window.close();
    }, 1500);
    
  } catch (error) {
    console.error('Failed to stop recording:', error);
    showError('Failed to save: ' + error.message);
    btnStop.disabled = false;
    btnStop.textContent = '⏹ Stop & Save';
  }
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
  
  const response = await fetch(`${SERVER_URL}/api/recording/chunk`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to upload ${type}`);
  }
  
  console.log(`${type} uploaded successfully`);
}

/**
 * Start duration timer
 */
function startDurationTimer() {
  durationInterval = setInterval(() => {
    if (startTime && !isPaused) {
      const elapsed = Date.now() - startTime;
      const seconds = Math.floor(elapsed / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      duration.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

/**
 * Show recording UI
 */
function showRecordingUI() {
  dot.className = 'recording-dot';
  status.textContent = 'Recording...';
  controlsReady.style.display = 'none';
  controlsRecording.style.display = 'flex';
}

/**
 * Show ready UI
 */
function showReadyUI() {
  dot.className = 'recording-dot ready';
  status.textContent = 'Click Start to begin recording';
  duration.textContent = '00:00';
  controlsReady.style.display = 'flex';
  controlsRecording.style.display = 'none';
  btnStart.disabled = false;
  btnStart.textContent = '🎬 Start Recording';
}

/**
 * Show error
 */
function showError(message) {
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

/**
 * Hide error
 */
function hideError() {
  errorDiv.style.display = 'none';
}
