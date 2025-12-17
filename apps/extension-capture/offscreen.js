/**
 * Offscreen Document for Media Recording
 * Required for Manifest V3 - MediaRecorder cannot run in service worker
 */

let mediaRecorder = null;
let audioRecorder = null;
let videoChunks = [];
let audioChunks = [];
let currentSessionId = null;
let mediaStream = null;

console.log('🎬 Offscreen document loaded and ready');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🎬 Offscreen received ANY message:', message.action, message.target);
  
  // Handle all messages, not just those with target='offscreen'
  // This helps debug message routing issues
  
  if (message.action === 'START_CAPTURE') {
    console.log('🎬 Offscreen: Received START_CAPTURE');
    startCapture(message.streamId, message.sessionId);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'STOP_CAPTURE') {
    console.log('🎬 Offscreen: Received STOP_CAPTURE');
    stopCapture();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'PAUSE_CAPTURE') {
    pauseCapture();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'RESUME_CAPTURE') {
    resumeCapture();
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});

/**
 * Start capturing with the provided stream ID
 */
async function startCapture(streamId, sessionId) {
  try {
    console.log('🎬 Offscreen: Starting capture with streamId:', streamId);
    currentSessionId = sessionId;
    videoChunks = [];
    audioChunks = [];
    
    // Get the media stream using the stream ID from tabCapture
    // Use the streamId as a constraint for getUserMedia
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
          maxWidth: 1920,
          maxHeight: 1080,
        },
      },
    };
    
    console.log('🎬 Offscreen: Requesting media with constraints');
    
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      console.error('🎬 Offscreen: getUserMedia failed:', e);
      // Try alternative method - getDisplayMedia for screen capture
      console.log('🎬 Offscreen: Trying getDisplayMedia as fallback...');
      mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: true,
      });
    }
    
    console.log('🎬 Offscreen: Got media stream:', {
      videoTracks: mediaStream.getVideoTracks().length,
      audioTracks: mediaStream.getAudioTracks().length,
    });
    
    // Create video MediaRecorder
    const videoTracks = mediaStream.getVideoTracks();
    if (videoTracks.length > 0) {
      const videoStream = new MediaStream(videoTracks);
      
      // Check supported mimeTypes
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';
      
      console.log('🎬 Offscreen: Using video mimeType:', mimeType);
      
      mediaRecorder = new MediaRecorder(videoStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('🎬 Offscreen: Video chunk received, size:', event.data.size);
        if (event.data.size > 0) {
          videoChunks.push(event.data);
        }
      };
      
      mediaRecorder.onerror = (e) => {
        console.error('🎬 Offscreen: MediaRecorder error:', e);
      };
      
      mediaRecorder.start(1000);
      console.log('🎬 Offscreen: Video recorder started');
    } else {
      console.warn('🎬 Offscreen: No video tracks available');
    }
    
    // Create audio MediaRecorder
    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const audioStream = new MediaStream(audioTracks);
      
      const audioMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
        
      console.log('🎬 Offscreen: Using audio mimeType:', audioMimeType);
      
      audioRecorder = new MediaRecorder(audioStream, {
        mimeType: audioMimeType,
        audioBitsPerSecond: 128000,
      });
      
      audioRecorder.ondataavailable = (event) => {
        console.log('🎬 Offscreen: Audio chunk received, size:', event.data.size);
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      audioRecorder.onerror = (e) => {
        console.error('🎬 Offscreen: Audio recorder error:', e);
      };
      
      audioRecorder.start(1000);
      console.log('🎬 Offscreen: Audio recorder started');
    } else {
      console.warn('🎬 Offscreen: No audio tracks available');
    }
    
    console.log('✅ Offscreen: Capture started successfully');
    
  } catch (error) {
    console.error('❌ Offscreen: Failed to start capture:', error);
  }
}

/**
 * Stop capturing and send data back
 */
async function stopCapture() {
  try {
    console.log('🛑 Offscreen: Stopping capture...', {
      videoChunks: videoChunks.length,
      audioChunks: audioChunks.length,
      mediaRecorderState: mediaRecorder?.state,
      audioRecorderState: audioRecorder?.state,
    });
    
    // Stop recorders
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      console.log('🛑 Offscreen: Video recorder stopped');
    }
    if (audioRecorder && audioRecorder.state !== 'inactive') {
      audioRecorder.stop();
      console.log('🛑 Offscreen: Audio recorder stopped');
    }
    
    // Wait for final chunks
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🛑 Offscreen: After waiting - video chunks:', videoChunks.length, 'audio chunks:', audioChunks.length);
    
    // Stop all tracks
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    
    // Send video data to server
    if (videoChunks.length > 0) {
      const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
      console.log('📤 Offscreen: Uploading video, size:', videoBlob.size);
      await sendRecordingData('video', videoBlob);
    } else {
      console.warn('⚠️ Offscreen: No video chunks to upload');
    }
    
    // Send audio data to server
    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('📤 Offscreen: Uploading audio, size:', audioBlob.size);
      await sendRecordingData('audio', audioBlob);
    } else {
      console.warn('⚠️ Offscreen: No audio chunks to upload');
    }
    
    // Reset state
    mediaRecorder = null;
    audioRecorder = null;
    videoChunks = [];
    audioChunks = [];
    mediaStream = null;
    
    console.log('✅ Offscreen: Capture stopped and uploaded');
    
  } catch (error) {
    console.error('Offscreen: Failed to stop capture:', error);
  }
}

/**
 * Pause capture
 */
function pauseCapture() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
  }
  if (audioRecorder && audioRecorder.state === 'recording') {
    audioRecorder.pause();
  }
}

/**
 * Resume capture
 */
function resumeCapture() {
  if (mediaRecorder && mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
  }
  if (audioRecorder && audioRecorder.state === 'paused') {
    audioRecorder.resume();
  }
}

/**
 * Send recording data via fetch (can't send Blob through message)
 */
async function sendRecordingData(type, blob) {
  const SERVER_URL = 'http://localhost:3000';
  
  try {
    const formData = new FormData();
    formData.append('chunk', blob, `${type}_0.webm`);
    formData.append('sessionId', currentSessionId);
    formData.append('chunkType', type);
    formData.append('chunkIndex', '0');
    formData.append('isLastChunk', 'true');
    
    await fetch(`${SERVER_URL}/api/recording/chunk`, {
      method: 'POST',
      body: formData,
    });
    
    console.log(`Offscreen: Uploaded ${type} chunk`);
  } catch (error) {
    console.error(`Offscreen: Failed to upload ${type}:`, error);
  }
}
