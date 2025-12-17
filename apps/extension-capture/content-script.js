/**
 * Content Script - DOM Event Tracking
 * Tracks user interactions (clicks, scrolls, focus, blur, input) and captures element metadata
 */

// Guard against multiple injections
if (window.__cluesoContentScriptLoaded) {
  console.log('🔌 Content script already loaded, skipping');
} else {
  window.__cluesoContentScriptLoaded = true;

const SERVER_URL = 'http://localhost:3000';

let trackingState = {
  isTracking: false,
  sessionId: null,
  events: [],
  startTime: null,
  batchInterval: null,
};

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'START_TRACKING':
      startTracking(message.sessionId);
      sendResponse({ success: true });
      break;
      
    case 'STOP_TRACKING':
      stopTracking();
      sendResponse({ success: true });
      break;
  }
  return false;
});

// Auto-start tracking when recording begins
// Check every 2 seconds if recording is active
setInterval(async () => {
  if (trackingState.isTracking) return; // Already tracking
  
  try {
    const data = await chrome.storage.local.get(['isRecording', 'sessionId']);
    if (data.isRecording && data.sessionId && !trackingState.isTracking) {
      console.log('🎯 Auto-starting DOM tracking for session:', data.sessionId);
      startTracking(data.sessionId);
    } else if (!data.isRecording && trackingState.isTracking) {
      console.log('🛑 Auto-stopping DOM tracking');
      stopTracking();
    }
  } catch (error) {
    // Ignore errors in auto-check
  }
}, 2000);

/**
 * Start tracking DOM events
 */
function startTracking(sessionId) {
  if (trackingState.isTracking) return;
  
  console.log('🎯 Starting DOM tracking for session:', sessionId);
  
  trackingState.isTracking = true;
  trackingState.sessionId = sessionId;
  trackingState.events = [];
  trackingState.startTime = Date.now();
  
  // Add event listeners
  document.addEventListener('click', handleClick, true);
  document.addEventListener('scroll', handleScroll, true);
  document.addEventListener('focus', handleFocus, true);
  document.addEventListener('blur', handleBlur, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('keydown', handleKeydown, true);
  
  // Batch send events every 5 seconds
  trackingState.batchInterval = setInterval(sendEventBatch, 5000);
}

/**
 * Stop tracking DOM events
 */
function stopTracking() {
  if (!trackingState.isTracking) return;
  
  console.log('🛑 Stopping DOM tracking');
  
  // Remove event listeners
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('scroll', handleScroll, true);
  document.removeEventListener('focus', handleFocus, true);
  document.removeEventListener('blur', handleBlur, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('keydown', handleKeydown, true);
  
  // Clear interval
  if (trackingState.batchInterval) {
    clearInterval(trackingState.batchInterval);
  }
  
  // Send remaining events
  sendEventBatch();
  
  // Reset state
  trackingState.isTracking = false;
  trackingState.sessionId = null;
  trackingState.events = [];
}

/**
 * Get element metadata for event target
 */
function getElementTarget(element) {
  if (!element || element === document || element === window) {
    return null;
  }
  
  const rect = element.getBoundingClientRect();
  
  return {
    tag: element.tagName,
    id: element.id || null,
    classes: Array.from(element.classList),
    text: getElementText(element),
    selector: generateSelector(element),
    bbox: {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    attributes: getRelevantAttributes(element),
    ...(element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ? {
      type: element.type,
      name: element.name,
    } : {}),
  };
}

/**
 * Get visible text content of an element
 */
function getElementText(element) {
  // For input elements, use placeholder or value (masked)
  if (element.tagName === 'INPUT') {
    return element.placeholder || element.getAttribute('aria-label') || '';
  }
  
  // For buttons and links, get inner text
  const text = element.innerText || element.textContent || '';
  return text.trim().substring(0, 100); // Limit to 100 chars
}

/**
 * Generate a unique CSS selector for an element
 */
function generateSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  const path = [];
  let current = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }
    
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).slice(0, 2);
      if (classes.length > 0 && classes[0]) {
        selector += '.' + classes.join('.');
      }
    }
    
    // Add nth-child if needed for uniqueness
    const siblings = current.parentElement?.children;
    if (siblings && siblings.length > 1) {
      const index = Array.from(siblings).indexOf(current) + 1;
      selector += `:nth-child(${index})`;
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ').substring(0, 200);
}

/**
 * Get relevant attributes from an element
 */
function getRelevantAttributes(element) {
  const relevant = ['data-testid', 'aria-label', 'role', 'href', 'src', 'alt', 'title', 'name'];
  const attrs = {};
  
  for (const attr of relevant) {
    if (element.hasAttribute(attr)) {
      attrs[attr] = element.getAttribute(attr)?.substring(0, 100);
    }
  }
  
  return attrs;
}

/**
 * Get current viewport and scroll metadata
 */
function getMetadata() {
  return {
    url: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scrollPosition: {
      x: window.scrollX,
      y: window.scrollY,
    },
  };
}

/**
 * Create a base event object
 */
function createEvent(type, extra = {}) {
  return {
    type,
    timestamp: Date.now(),
    metadata: getMetadata(),
    ...extra,
  };
}

// Event Handlers
function handleClick(e) {
  const event = createEvent('click', {
    target: getElementTarget(e.target),
  });
  trackingState.events.push(event);
  
  // Notify background script
  chrome.runtime.sendMessage({
    action: 'DOM_EVENT',
    event,
  });
}

let scrollTimeout;
function handleScroll(e) {
  // Debounce scroll events
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const event = createEvent('scroll', {
      scrollPosition: {
        x: window.scrollX,
        y: window.scrollY,
      },
    });
    trackingState.events.push(event);
  }, 100);
}

function handleFocus(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    const event = createEvent('focus', {
      target: getElementTarget(e.target),
    });
    trackingState.events.push(event);
  }
}

function handleBlur(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    const event = createEvent('blur', {
      target: getElementTarget(e.target),
    });
    trackingState.events.push(event);
  }
}

let inputTimeout;
function handleInput(e) {
  // Debounce input events
  clearTimeout(inputTimeout);
  inputTimeout = setTimeout(() => {
    const event = createEvent('input', {
      target: getElementTarget(e.target),
      inputValue: '[REDACTED]', // Don't capture actual input for privacy
    });
    trackingState.events.push(event);
  }, 300);
}

function handleKeydown(e) {
  // Only track special keys (Enter, Escape, Tab, shortcuts)
  const specialKeys = ['Enter', 'Escape', 'Tab'];
  const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
  
  if (specialKeys.includes(e.key) || hasModifier) {
    const event = createEvent('keydown', {
      key: e.key,
      code: e.code,
      modifiers: {
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      },
    });
    trackingState.events.push(event);
  }
}

/**
 * Send batched events to server
 */
async function sendEventBatch() {
  if (trackingState.events.length === 0 || !trackingState.sessionId) return;
  
  const events = [...trackingState.events];
  trackingState.events = [];
  
  try {
    await fetch(`${SERVER_URL}/api/recording/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: trackingState.sessionId,
        events,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      }),
    });
    
    console.log(`📤 Sent ${events.length} DOM events`);
  } catch (error) {
    console.error('Failed to send events:', error);
    // Re-add events to queue on failure
    trackingState.events = [...events, ...trackingState.events];
  }
}

// Initialize
console.log('🔌 Clueso.io Clone content script loaded');

} // End of guard block
