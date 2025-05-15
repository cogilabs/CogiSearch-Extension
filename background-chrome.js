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
      const newBangs = changes.userBangs.newValue || [];
      
      // Check if this is an intentional deletion
      const isIntentionalDeletion = changes.bangsIntentionallyDeleted?.newValue === true;
      
      // Respect deletions - if the array is empty AND it was an intentional deletion, 
      // don't try to merge or restore old bangs
      if (isIntentionalDeletion && newBangs.length === 0) {
        console.log("Bang deletion detected - not merging");
        
        // Notify content scripts about the deletion
        notifyContentScriptAboutChanges([]);
        return;
      }
      
      // Normal case - notify content scripts about changes  
      notifyContentScriptAboutChanges(newBangs);
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

} catch (e) {
  console.error('Error in background-chrome.js:', e);
}