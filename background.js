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

  // Listen for changes in storage
  browserAPI.storage.onChanged.addListener(async function(changes, areaName) {
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
}