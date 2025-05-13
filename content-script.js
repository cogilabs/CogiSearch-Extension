// Store original localStorage methods
const originalGetItem = localStorage.getItem;
const originalSetItem = localStorage.setItem;
const originalRemoveItem = localStorage.removeItem;

// Flag to track if migration has been completed
let migrationCompleted = false;
let bangsLoadedFromExtension = false;

// Run migration once when page loads
(async function() {
  try {
    const { migrationDone } = await browser.storage.local.get('migrationDone');
    
    if (!migrationDone) {
      // Execute migration when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', performMigration);
      } else {
        performMigration();
      }
    } else {
      // Setup page with userBangs from browser.storage.sync
      await loadBangsFromExtensionStorage();
    }
  } catch (error) {
    console.error('Error checking migration status:', error);
  }
})();

// Update conflict detection in performMigration
async function performMigration() {
  try {
    const localBangsString = originalGetItem.call(localStorage, 'userBangs');
    
    if (localBangsString) {
      const localBangs = JSON.parse(localBangsString);
      
      // Get any existing bangs from sync storage
      const syncData = await browser.storage.sync.get('userBangs');
      const syncBangs = syncData.userBangs || [];
      
      // If there are no sync bangs, just use local bangs
      if (!syncBangs.length) {
        await browser.storage.sync.set({ userBangs: localBangs });
      } else {
        // Prepare containers for our analysis
        const conflictBangs = [];
        const localBangNames = new Set(localBangs.map(b => b.s));
        const syncBangNames = new Set(syncBangs.map(b => b.s));
        
        // Find conflicts (same name, different URL)
        for (const localBang of localBangs) {
          const syncMatch = syncBangs.find(b => b.s === localBang.s);
          
          if (syncMatch) {
            // Explicitly compare the URLs
            const localUrl = localBang.u ? localBang.u.trim() : '';
            const syncUrl = syncMatch.u ? syncMatch.u.trim() : '';
            
            if (localUrl !== syncUrl) {
              conflictBangs.push({
                name: localBang.s,
                local: localBang,
                sync: syncMatch
              });
            }
            // If URLs match, no conflict - sync version will be kept
          }
        }
        
        // Create array of unique local bangs (not in sync)
        const uniqueLocalBangs = localBangs.filter(b => !syncBangNames.has(b.s));
        
        // Start with a copy of sync bangs
        const mergedBangs = [...syncBangs];
        
        // Add unique local bangs
        mergedBangs.push(...uniqueLocalBangs);
        
        // If there are conflicts, show the UI
        if (conflictBangs.length > 0) {
          try {
            await showConflictResolutionUI(conflictBangs, mergedBangs);
          } catch (error) {
            console.error('Error in conflict resolution UI:', error);
            // If UI fails, just save the merged bangs without resolving conflicts
            await browser.storage.sync.set({ userBangs: mergedBangs });
          }
        } else {
          await browser.storage.sync.set({ userBangs: mergedBangs });
        }
      }
    }
    
    // Mark migration as completed
    await browser.storage.local.set({ migrationDone: true });
    migrationCompleted = true;
    
    // Final check to ensure local and extension storage are in sync
    const { userBangs } = await browser.storage.sync.get('userBangs');
    if (userBangs && Array.isArray(userBangs)) {
      originalSetItem.call(localStorage, 'userBangs', JSON.stringify(userBangs));
    }
    
  } catch (error) {
    console.error('Error during bangs migration:', error);
  }
}

// Show UI for resolving bang conflicts
async function showConflictResolutionUI(conflicts, mergedBangs) {
  // Create the modal container
  const modalContainer = document.createElement('div');
  modalContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // Create the modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 24px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  `;
  
  // Add title and description
  modal.innerHTML = `
    <h2 style="margin-top: 0; color: #333;">Bang Conflict Resolution</h2>
    <p>Some of your custom bangs have the same name but different URLs across devices.
    Please select which version to keep for each conflict:</p>
    <div id="conflicts-container"></div>
    <div style="margin-top: 24px; text-align: right;">
      <button id="resolve-conflicts-btn" style="
        background-color: #4361ee; 
        color: white; 
        border: none; 
        padding: 8px 16px; 
        border-radius: 4px; 
        cursor: pointer;
        font-weight: 500;
      ">Save Choices</button>
    </div>
  `;
  
  // Add to document
  modalContainer.appendChild(modal);
  document.body.appendChild(modalContainer);
  
  // Populate the conflicts
  const conflictsContainer = document.getElementById('conflicts-container');
  
  conflicts.forEach((conflict, index) => {
    const conflictEl = document.createElement('div');
    conflictEl.style.cssText = `
      border: 1px solid #eee;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    `;
    
    conflictEl.innerHTML = `
      <h3 style="margin-top: 0; font-size: 16px; color: #444;">Bang: !${conflict.name}</h3>
      
      <div style="display: flex; margin-bottom: 12px;">
        <input type="radio" id="sync-${index}" name="conflict-${index}" value="sync" checked>
        <label for="sync-${index}" style="margin-left: 8px; flex: 1;">
          <strong>Synced version:</strong> 
          <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px;">${conflict.sync.u}</code>
          <div><small>Domain: ${conflict.sync.d}</small></div>
        </label>
      </div>
      
      <div style="display: flex; margin-bottom: 12px;">
        <input type="radio" id="local-${index}" name="conflict-${index}" value="local">
        <label for="local-${index}" style="margin-left: 8px; flex: 1;">
          <strong>This device:</strong> 
          <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px;">${conflict.local.u}</code>
          <div><small>Domain: ${conflict.local.d}</small></div>
        </label>
      </div>
      
      <div style="display: flex;">
        <input type="radio" id="both-${index}" name="conflict-${index}" value="both">
        <label for="both-${index}" style="margin-left: 8px; flex: 1;">
          <strong>Keep both</strong> (rename local to !${conflict.name}2)
        </label>
      </div>
    `;
    
    conflictsContainer.appendChild(conflictEl);
  });
  
  // Handle save button click
  return new Promise((resolve) => {
    document.getElementById('resolve-conflicts-btn').addEventListener('click', async () => {
      try {
        // Process user choices
        for (let i = 0; i < conflicts.length; i++) {
          const conflict = conflicts[i];
          const radioSelector = `input[name="conflict-${i}"]:checked`;
          const selectedRadio = document.querySelector(radioSelector);
          
          if (!selectedRadio) {
            continue;
          }
          
          const choice = selectedRadio.value;
          
          // Find existing bang in merged collection
          const existingIndex = mergedBangs.findIndex(b => b.s === conflict.name);
          
          if (choice === 'local') {
            // Replace with local version
            if (existingIndex !== -1) {
              mergedBangs[existingIndex] = conflict.local;
            }
          } else if (choice === 'both') {
            // Keep sync version and add local with modified name
            const renamedBang = { 
              ...conflict.local, 
              s: `${conflict.name}2`, 
              t: `${conflict.name}2` 
            };
            mergedBangs.push(renamedBang);
          }
          // For 'sync' choice, do nothing as sync version is already in mergedBangs
        }
        
        // Save the merged bangs
        await browser.storage.sync.set({ userBangs: mergedBangs });
        
        // Also update localStorage to ensure consistency
        originalSetItem.call(localStorage, 'userBangs', JSON.stringify(mergedBangs));
        
        // Remove modal
        document.body.removeChild(modalContainer);
        
        resolve(mergedBangs);
      } catch (error) {
        console.error('Error in conflict resolution:', error);
        alert('An error occurred while resolving conflicts.');
        // Still try to resolve the promise to avoid hanging
        resolve([]);
      }
    });
  });
}

// Load bangs from extension storage into the page
async function loadBangsFromExtensionStorage() {
  try {
    const { userBangs } = await browser.storage.sync.get('userBangs');
    
    if (userBangs && Array.isArray(userBangs)) {
      // Save to localStorage to make it available to the page
      originalSetItem.call(localStorage, 'userBangs', JSON.stringify(userBangs));
      bangsLoadedFromExtension = true;
      
      // Notify the page about the updated bangs
      try {
        window.dispatchEvent(new CustomEvent('storage', {
          detail: { 
            key: 'userBangs', 
            newValue: JSON.stringify(userBangs)
          }
        }));
      } catch (e) {
        console.error('Error dispatching storage event:', e);
      }
      
      // Make sure page UI is updated
      setTimeout(() => {
        try {
          // Find and call the page's function to populate user bangs list if it exists
          if (typeof window.populateUserBangsList === 'function') {
            window.populateUserBangsList();
          }
        } catch (e) {
          console.error('Error calling page function:', e);
        }
      }, 500);
    }
  } catch (error) {
    console.error('Error loading bangs from extension storage:', error);
  }
}

// Intercept localStorage.getItem for userBangs
localStorage.getItem = function(key) {
  if (key === 'userBangs') {
    // Return the value from localStorage
    const value = originalGetItem.call(localStorage, key);
    
    // If no value or empty array, and we haven't loaded from extension yet,
    // trigger a load from extension storage
    if ((!value || value === '[]') && !bangsLoadedFromExtension) {
      setTimeout(() => {
        loadBangsFromExtensionStorage();
      }, 0);
    }
    
    return value;
  }
  
  // Pass through for other keys
  return originalGetItem.call(localStorage, key);
};

// Intercept localStorage.setItem for userBangs
localStorage.setItem = function(key, value) {
  if (key === 'userBangs') {
    // Always update localStorage first for immediate use by the page
    originalSetItem.call(localStorage, key, value);
    
    // Then sync to extension storage
    try {
      const bangs = JSON.parse(value);
      if (Array.isArray(bangs)) {
        browser.storage.sync.set({ userBangs: bangs })
          .catch(e => console.error('Error saving bangs to extension storage:', e));
      }
    } catch (e) {
      console.error('Error parsing userBangs JSON:', e);
    }
    
    return value;
  }
  
  // Pass through for other keys
  return originalSetItem.call(localStorage, key, value);
};

// Intercept localStorage.removeItem for userBangs
localStorage.removeItem = function(key) {
  if (key === 'userBangs') {
    // Remove from localStorage
    originalRemoveItem.call(localStorage, key);
    
    // Also clear (don't just remove) from extension storage
    browser.storage.sync.set({ userBangs: [] })
      .catch(e => console.error('Error clearing bangs from extension storage:', e));
    
    return true;
  }
  
  // Pass through for other keys
  return originalRemoveItem.call(localStorage, key);
};

// Listen for page load event to ensure bangs are loaded
window.addEventListener('load', () => {
  // Short timeout to allow the page's own scripts to initialize
  setTimeout(loadBangsFromExtensionStorage, 700);
  
  // Monitor DOM for changes that might indicate user bang list has been loaded
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const bangSection = document.querySelector('#user-banglist-title');
        if (bangSection && !bangSection.dataset.monitored) {
          bangSection.dataset.monitored = 'true';
          loadBangsFromExtensionStorage();
        }
      }
    }
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
});

// Save bangs when they change via the web UI
document.addEventListener('submit', (event) => {
  if (event.target.classList.contains('user-bang-container')) {
    // Give the page time to update localStorage
    setTimeout(() => {
      const bangsString = originalGetItem.call(localStorage, 'userBangs');
      if (bangsString) {
        try {
          const bangs = JSON.parse(bangsString);
          browser.storage.sync.set({ userBangs: bangs })
            .catch(e => console.error('Error saving bangs to extension storage after form submission:', e));
        } catch (e) {
          console.error('Error parsing userBangs JSON after form submission:', e);
        }
      }
    }, 100);
  }
});

// Listen for messages from popup or background script - with browser detection
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
if (browserAPI && browserAPI.runtime && browserAPI.runtime.onMessage) {
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle storage update notifications
    if (message.action === "storageUpdated" && message.userBangs) {
      // Update localStorage with the new bangs
      originalSetItem.call(localStorage, 'userBangs', JSON.stringify(message.userBangs));
      
      // Notify the website
      window.dispatchEvent(new CustomEvent('storage', {
        detail: { 
          key: 'userBangs', 
          newValue: JSON.stringify(message.userBangs) 
        }
      }));
      
      sendResponse({ success: true });
      return true;
    }
    
    // Handle localStorage check requests
    if (message.action === "checkLocalStorage") {
      const userBangs = originalGetItem.call(localStorage, 'userBangs');
      sendResponse({ userBangs });
      return true;
    }
    
    // Handle force sync requests
    if (message.action === "forceSync") {
      loadBangsFromExtensionStorage()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
  });
}

// Monitor for changes made by the CogiSearch website to userBangs
let lastUserBangsValue = originalGetItem.call(localStorage, 'userBangs');
setInterval(() => {
  const currentValue = originalGetItem.call(localStorage, 'userBangs');
  if (currentValue !== lastUserBangsValue) {
    lastUserBangsValue = currentValue;
    
    try {
      // Handle both updates and deletions
      if (currentValue) {
        // Normal case: localStorage has bangs, update sync storage
        const bangs = JSON.parse(currentValue);
        browser.storage.sync.set({ userBangs: bangs })
          .catch(e => console.error('Error saving bangs to extension storage after change detection:', e));
      } else {
        // Handle deletion case: localStorage was cleared or set to null/undefined
        browser.storage.sync.set({ userBangs: [] })
          .catch(e => console.error('Error clearing bangs in extension storage:', e));
      }
    } catch (e) {
      console.error('Error handling userBangs change:', e);
    }
  }
}, 1000); // Check every second

function enhanceBangDescription() {
  // Wait for the element to be present in the DOM
  const interval = setInterval(() => {
    const bangsDescription = document.querySelector('.user-banglist-container p');
    if (bangsDescription) {
      clearInterval(interval);
      
      // Determine browser type
      const isFirefox = navigator.userAgent.includes('Firefox') || 
                        typeof InstallTrigger !== 'undefined';
      
      // Add sync information based on browser type
      if (isFirefox) {
        bangsDescription.innerHTML = 
          "This section will allow you to add your own bangs to CogiSearch. " +
          "They will be saved in your browser memory and synchronized through your Firefox account.";
      } else {
        bangsDescription.innerHTML = 
          "This section will allow you to add your own bangs to CogiSearch. " +
          "They will be saved in your browser memory and synchronized through your Google account.";
      }
    }
  }, 500); // Check every 500ms
}

// Call this function when the page loads
window.addEventListener('load', enhanceBangDescription);

// Also call it when DOM changes occur in case the element loads later
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList' && 
        document.querySelector('.user-banglist-container')) {
      enhanceBangDescription();
    }
  }
});

observer.observe(document.body, { 
  childList: true, 
  subtree: true 
});