/**
 * Background Service Worker
 * Handles communication between side panel, content scripts, and manages side panel behavior
 */

const SERVER_URL = 'http://localhost:3000';

console.log('Clueso.io Clone extension installed');

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Extension icon clicked, opening side panel');
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

// Set side panel behavior - open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(error => console.error('Failed to set panel behavior:', error));

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received:', message.action);
  
  switch (message.action) {
    case 'RECORDING_STARTED':
      console.log('Recording started for session:', message.sessionId);
      chrome.action.setBadgeText({ text: 'REC' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      sendResponse({ success: true });
      return false;
      
    case 'RECORDING_COMPLETED':
      console.log('Recording completed for session:', message.sessionId);
      chrome.storage.local.remove(['isRecording', 'sessionId', 'startTime', 'tabUrl']);
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ success: true });
      return false;
      
    case 'GET_STATUS':
      chrome.storage.local.get(['isRecording', 'sessionId', 'startTime'], (data) => {
        sendResponse({
          isRecording: data.isRecording || false,
          sessionId: data.sessionId || null,
          duration: data.startTime ? Date.now() - data.startTime : 0,
        });
      });
      return true;
      
    case 'DOM_EVENT':
      handleDOMEvent(message.event, message.sessionId);
      return false;
  }
});

/**
 * Handle DOM events from content script
 */
async function handleDOMEvent(event, sessionId) {
  if (!sessionId) {
    const data = await chrome.storage.local.get(['sessionId']);
    sessionId = data.sessionId;
  }
  
  if (!sessionId) return;
  
  try {
    await fetch(`${SERVER_URL}/api/recording/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        events: [event],
      }),
    });
  } catch (error) {
    console.error('Failed to send DOM event:', error);
  }
}

// Handle extension install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Clueso.io Clone extension installed/updated');
});
