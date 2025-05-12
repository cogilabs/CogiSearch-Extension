/**
 * Browser API compatibility layer
 */
(function() {
  'use strict';

  // Explicit browser detection
  const isFirefox = typeof browser !== 'undefined' && Object.getPrototypeOf(browser) === Object.prototype;
  const isChrome = !isFirefox && typeof chrome !== 'undefined';  

  // Check if we're in Firefox (browser is already defined)
  if (isFirefox) {
    return; // Exit early - no need for polyfill in Firefox
  }
  
  // Define global browser if it doesn't exist (Chrome)
  if (typeof globalThis.browser === 'undefined') {
    globalThis.browser = {};
  }

  const apis = [
    'runtime',
    'storage',
    'tabs',
    'contextMenus',
    'notifications',
    'scripting'
  ];

  // For each API, create polyfill if needed
  for (const api of apis) {
    if (!globalThis.browser[api]) {
      globalThis.browser[api] = {};
    }
    
    // Skip if Chrome doesn't support this API
    if (!chrome[api]) continue;
    
    // Copy methods from chrome to browser
    for (const method in chrome[api]) {
      if (typeof chrome[api][method] === 'function' && !globalThis.browser[api][method]) {
        globalThis.browser[api][method] = function(...args) {
          return new Promise((resolve, reject) => {
            try {
              chrome[api][method](...args, function(result) {
                const chromeError = chrome.runtime.lastError;
                if (chromeError) {
                  reject(new Error(chromeError.message));
                } else {
                  resolve(result);
                }
              });
            } catch (err) {
              reject(err);
            }
          });
        };
      }
    }
  }
  
  // Special cases for storage APIs
  ['sync', 'local'].forEach(storageArea => {
    if (chrome.storage && (!globalThis.browser.storage || !globalThis.browser.storage[storageArea])) {
      if (!globalThis.browser.storage) {
        globalThis.browser.storage = {};
      }
      if (!globalThis.browser.storage[storageArea]) {
        globalThis.browser.storage[storageArea] = {
          get: function(keys) {
            return new Promise((resolve, reject) => {
              try {
                chrome.storage[storageArea].get(keys, function(result) {
                  const chromeError = chrome.runtime.lastError;
                  if (chromeError) {
                    reject(new Error(chromeError.message));
                  } else {
                    resolve(result);
                  }
                });
              } catch (err) {
                reject(err);
              }
            });
          },
          set: function(items) {
            return new Promise((resolve, reject) => {
              try {
                chrome.storage[storageArea].set(items, function() {
                  const chromeError = chrome.runtime.lastError;
                  if (chromeError) {
                    reject(new Error(chromeError.message));
                  } else {
                    resolve();
                  }
                });
              } catch (err) {
                reject(err);
              }
            });
          },
          remove: function(keys) {
            return new Promise((resolve, reject) => {
              try {
                chrome.storage[storageArea].remove(keys, function() {
                  const chromeError = chrome.runtime.lastError;
                  if (chromeError) {
                    reject(new Error(chromeError.message));
                  } else {
                    resolve();
                  }
                });
              } catch (err) {
                reject(err);
              }
            });
          }
        };
      }
    }
  });
})();
