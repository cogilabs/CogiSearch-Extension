// Use the browserAPI defined in the wrapper or detect it here if running directly
const browserAPI = self.browserAPI || (typeof browser !== 'undefined' ? browser : chrome);

// Make all code conditional to avoid errors
if (browserAPI && browserAPI.runtime) {
  // Handle extension installation or update
  browserAPI.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install' || details.reason === 'update') {
      // Use callback style which works in both browsers
      browserAPI.storage.local.set({ migrationDone: false }, function() {
        if (browserAPI.runtime.lastError) {
          console.error("Error setting migration flag:", browserAPI.runtime.lastError);
        } else {
          // Create context menu items
          createContextMenuItems();
        }
      });
    }
  });

  // Listen for changes in storage to update UI in real-time across instances
  browserAPI.storage.onChanged.addListener(function(changes, areaName) {
    if (areaName === 'sync' && changes.userBangs) {
      // Notify content script about storage changes
      notifyContentScriptAboutChanges(changes.userBangs.newValue);
    }
  });

  // Notify content script about storage changes if the page is open
  function notifyContentScriptAboutChanges(userBangs) {
    browserAPI.tabs.query({ url: "https://search.cogilabs.eu/*" }, function(tabs) {
      if (tabs.length > 0) {
        for (const tab of tabs) {
          browserAPI.tabs.sendMessage(tab.id, { 
            action: "storageUpdated", 
            userBangs 
          }).catch(function(err) {
            // Silently catch errors when tab isn't ready yet
          });
        }
      }
    });
  }

  // Create context menu items for quick search
  function createContextMenuItems() {
    // Create context menu items if supported
    if (browserAPI.contextMenus) {
      browserAPI.contextMenus.create({
        id: "search-cogisearch",
        title: "Search with CogiSearch", 
        contexts: ["selection"]
      });
      
      browserAPI.contextMenus.onClicked.addListener(function(info, tab) {
        if (info.menuItemId === "search-cogisearch") {
          browserAPI.tabs.create({
            url: `https://search.cogilabs.eu/?q=${encodeURIComponent(info.selectionText)}`
          });
        }
      });
    }
  }
}