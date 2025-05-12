// For Chrome, we use the Chrome-specific background script
try {
  importScripts('background-chrome.js');
} catch (e) {
  console.error('Error in background-wrapper.js:', e);
}