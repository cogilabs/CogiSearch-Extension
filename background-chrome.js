// This is a Chrome-specific background script that uses Chrome APIs directly
try {
  // Make sure chrome API is available
  if (!chrome || !chrome.runtime) {
    throw new Error('Chrome API not available');
  }

  // Handle extension installation or update
  chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install' || details.reason === 'update') {
      // Use callback style for Chrome
      chrome.storage.local.set({ migrationDone: false }, function() {
        if (chrome.runtime.lastError) {
          console.error("Error setting migration flag:", chrome.runtime.lastError);
        } else {
          // Create context menu items
          createContextMenuItems();
        }
      });
    }
  });

  // Listen for changes in storage to update UI in real-time across instances
  chrome.storage.onChanged.addListener(function(changes, areaName) {
    if (areaName === 'sync' && changes.userBangs) {
      // Notify content script about storage changes
      notifyContentScriptAboutChanges(changes.userBangs.newValue);
    }
  });

  // Notify content script about storage changes if the page is open
  function notifyContentScriptAboutChanges(userBangs) {
    chrome.tabs.query({ url: "https://search.cogilabs.eu/*" }, function(tabs) {
      if (tabs.length > 0) {
        for (const tab of tabs) {
          try {
            chrome.tabs.sendMessage(tab.id, { 
              action: "storageUpdated", 
              userBangs 
            }, function(response) {
              if (chrome.runtime.lastError) {
                // Silently catch errors when tab isn't ready yet
              }
            });
          } catch (err) {
            console.error("Error sending message:", err);
          }
        }
      }
    });
  }

  // Create context menu items for quick search
  function createContextMenuItems() {
    // Create context menu items if supported
    if (chrome.contextMenus) {
      chrome.contextMenus.create({
        id: "search-cogisearch",
        title: "Search with CogiSearch", 
        contexts: ["selection"]
      });
      
      chrome.contextMenus.onClicked.addListener(function(info, tab) {
        if (info.menuItemId === "search-cogisearch") {
          chrome.tabs.create({
            url: `https://search.cogilabs.eu/?q=${encodeURIComponent(info.selectionText)}`
          });
        }
      });
    }
  }

  function mergeBangs(existingBangs, newBangs) {
    // Start with existing bangs
    const mergedBangs = [...existingBangs];
    // Track existing bang shortnames for quick lookup
    const existingShortnames = new Set(existingBangs.map(b => b.s));
    
    // Add new bangs that don't exist in the existing set
    for (const newBang of newBangs) {
      if (!existingShortnames.has(newBang.s)) {
        mergedBangs.push(newBang);
      }
    }
    
    return mergedBangs;
  }

  // Listen for changes to sync storage and properly merge
  chrome.storage.sync.onChanged.addListener(function(changes) {
    if (changes.userBangs) {
      const syncBangs = changes.userBangs.newValue || [];
      
      // Get current local bangs
      let localBangsString = localStorage.getItem('userBangs');
      let localBangs = [];
      
      try {
        if (localBangsString) {
          localBangs = JSON.parse(localBangsString);
        }
      } catch (e) {
        console.error('Error parsing local bangs:', e);
      }
      
      // IMPORTANT: Merge rather than replace
      const mergedBangs = mergeBangs(localBangs, syncBangs);
      
      // Update localStorage with merged bangs
      localStorage.setItem('userBangs', JSON.stringify(mergedBangs));
      
      // Also update sync storage if needed to ensure other browsers get the unique bangs
      if (mergedBangs.length > syncBangs.length) {
        chrome.storage.sync.set({ userBangs: mergedBangs }, function() {
          if (chrome.runtime.lastError) {
            console.error("Error updating sync storage:", chrome.runtime.lastError);
          }
        });
      }
      
      console.log('Merged bangs from sync:', { 
        syncBangs, 
        localBangs, 
        mergedResult: mergedBangs 
      });
    }
  });
} catch (e) {
  console.error('Error in background-chrome.js:', e);
}