/**
 * Popup Script - Direct Recording in Popup
 * 
 * The popup stays open during recording. Recording controls are here.
 * Note: Recording will stop if the popup is closed.
 */

const SERVER_URL = 'http://localhost:3000';

// DOM elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const durationEl = document.getElementById('duration');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const errorEl = document.getElementById('error');
const captureNote = document.getElementById('capture-note');

// Recording state
let mediaStream = null;
let mediaRecorder = null;
let audioRecorder = null;
let videoChunks = [];
let audioChunks = [];
let sessionId = null;
let startTime = null;
let durationInterval = null;
let isPaused = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');
  await checkRecordingStatus();
});

// Button handlers
btnStart.addEventListener('click', startRecording);
btnPause.addEventListener('click', togglePause);
btnStop.addEventListener('click', stopRecording);

/**
 * Check if we're already recording
 */
async function checkRecordingStatus() {
  try {
    const data = await chrome.storage.local.get(['isRecording']);
    
    if (data.isRecording) {
      // Recording was in progress but popup closed - reset state
      await chrome.storage.local.remove(['isRecording', 'sessionId', 'startTime']);
      chrome.action.setBadgeText({ text: '' });
    }
    
    showReadyUI();
  } catch (error) {
    console.error('Error checking status:', error);
    showReadyUI();
  }
}

/**
 * Start recording
 */
async function startRecording() {
  try {
    btnStart.disabled = true;
    btnStart.innerHTML = '<span>Starting...</span>';
    hideError();
    
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    // Check if we can record
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      throw new Error('Cannot record Chrome internal pages. Navigate to a website first.');
    }
    
    // Create session
    console.log('Creating session...');
    const sessionResponse = await fetch(`${SERVER_URL}/api/recording/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: tab.url,
        viewport: { width: 1920, height: 1080 },
      }),
    });
    
    const sessionData = await sessionResponse.json();
    
    if (!sessionData.success) {
      throw new Error(sessionData.error || 'Failed to start session');
    }
    
    sessionId = sessionData.data.sessionId;
    console.log('Session created:', sessionId);
    
    // Request screen capture
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
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
      systemAudio: 'include',
    });
    
    console.log('Got media stream:', {
      video: mediaStream.getVideoTracks().length,
      audio: mediaStream.getAudioTracks().length,
    });
    
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
          console.log('Audio chunk:', audioChunks.length);
        }
      };
      
      audioRecorder.start(1000);
      console.log('Audio recorder started');
    } else {
      console.warn('No audio - check "Share tab audio" in the picker');
    }
    
    // Handle stream ending
    mediaStream.getVideoTracks()[0].onended = () => {
      console.log('Stream ended by user');
      stopRecording();
    };
    
    // Save state
    startTime = Date.now();
    await chrome.storage.local.set({
      isRecording: true,
      sessionId: sessionId,
      startTime: startTime,
    });
    
    // Update badge
    chrome.action.setBadgeText({ text: 'REC' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    
    // Update UI
    showRecordingUI();
    startDurationTimer();
    
  } catch (error) {
    console.error('Failed to start recording:', error);
    
    if (error.name === 'NotAllowedError') {
      showError('Screen capture was cancelled');
    } else {
      showError(error.message);
    }
    
    showReadyUI();
    cleanup();
  }
}

/**
 * Toggle pause/resume
 */
function togglePause() {
  if (isPaused) {
    if (mediaRecorder && mediaRecorder.state === 'paused') mediaRecorder.resume();
    if (audioRecorder && audioRecorder.state === 'paused') audioRecorder.resume();
    isPaused = false;
    statusDot.className = 'status-dot recording';
    statusText.textContent = 'Recording...';
    btnPause.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;
    chrome.action.setBadgeText({ text: 'REC' });
  } else {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.pause();
    if (audioRecorder && audioRecorder.state === 'recording') audioRecorder.pause();
    isPaused = true;
    statusDot.className = 'status-dot paused';
    statusText.textContent = 'Paused';
    btnPause.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Resume`;
    chrome.action.setBadgeText({ text: '||' });
  }
}

/**
 * Stop recording and upload
 */
async function stopRecording() {
  try {
    btnStop.disabled = true;
    btnStop.textContent = 'Saving...';
    statusText.textContent = 'Saving...';
    
    // Stop recorders
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (audioRecorder && audioRecorder.state !== 'inactive') audioRecorder.stop();
    
    // Wait for final data
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Stop all tracks
    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
    
    // Stop timer
    if (durationInterval) clearInterval(durationInterval);
    
    console.log('Uploading - Video:', videoChunks.length, 'Audio:', audioChunks.length);
    
    // Upload video
    if (videoChunks.length > 0) {
      statusText.textContent = 'Uploading video...';
      const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
      console.log('Video blob size:', videoBlob.size);
      await uploadChunk(videoBlob, 'video');
    }
    
    // Upload audio
    if (audioChunks.length > 0) {
      statusText.textContent = 'Uploading audio...';
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('Audio blob size:', audioBlob.size);
      await uploadChunk(audioBlob, 'audio');
    }
    
    // Notify server to process
    statusText.textContent = 'Processing...';
    await fetch(`${SERVER_URL}/api/recording/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    
    console.log('Recording saved!');
    
    // Clear state
    await chrome.storage.local.remove(['isRecording', 'sessionId', 'startTime']);
    chrome.action.setBadgeText({ text: '' });
    
    // Show success
    statusText.textContent = '✓ Saved!';
    statusDot.className = 'status-dot';
    
    // Reset after delay
    setTimeout(() => {
      cleanup();
      showReadyUI();
    }, 1500);
    
  } catch (error) {
    console.error('Failed to stop recording:', error);
    showError('Failed to save: ' + error.message);
    cleanup();
    showReadyUI();
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
    const text = await response.text();
    console.error('Upload failed:', response.status, text);
    throw new Error(`Failed to upload ${type}: ${response.status}`);
  }
  
  const result = await response.json();
  console.log(`${type} uploaded:`, result);
}

/**
 * Cleanup recording state
 */
function cleanup() {
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
  mediaStream = null;
  mediaRecorder = null;
  audioRecorder = null;
  videoChunks = [];
  audioChunks = [];
  sessionId = null;
  startTime = null;
  isPaused = false;
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
}

/**
 * Start duration timer
 */
function startDurationTimer() {
  durationInterval = setInterval(() => {
    if (startTime && !isPaused) {
      const elapsed = Date.now() - startTime;
      const secs = Math.floor(elapsed / 1000);
      const mins = Math.floor(secs / 60);
      durationEl.textContent = `${mins.toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
    }
  }, 1000);
}

/**
 * Show recording UI
 */
function showRecordingUI() {
  statusDot.className = 'status-dot recording';
  statusText.textContent = 'Recording... (keep popup open)';
  if (captureNote) captureNote.style.display = 'none';
  btnStart.style.display = 'none';
  btnPause.style.display = 'flex';
  btnPause.disabled = false;
  btnPause.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;
  btnStop.style.display = 'flex';
  btnStop.disabled = false;
  btnStop.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> Stop`;
}

/**
 * Show ready UI
 */
function showReadyUI() {
  statusDot.className = 'status-dot';
  statusText.textContent = 'Ready to record';
  durationEl.textContent = '00:00';
  if (captureNote) captureNote.style.display = 'block';
  btnStart.style.display = 'flex';
  btnStart.disabled = false;
  btnStart.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg> Record`;
  btnPause.style.display = 'none';
  btnStop.style.display = 'none';
}

/**
 * Show error
 */
function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

/**
 * Hide error
 */
function hideError() {
  errorEl.style.display = 'none';
}
