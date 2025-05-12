// Get browserAPI using the polyfill
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Add setup sync storage button functionality
document.getElementById('setupTest').addEventListener('click', async () => {
  try {
    // Reset migration flag to force migration to happen
    await browserAPI.storage.local.set({ migrationDone: false });
    
    // Set up conflicting data in sync storage
    await browserAPI.storage.sync.set({
      userBangs: [
        {
          "d": "google.de",
          "r": 500,
          "s": "g",
          "t": "g",
          "u": "https://google.de/search?q={{{s}}}"
        },
        {
          "d": "youtube.com",
          "r": 500, 
          "s": "y",
          "t": "y",
          "u": "https://youtube.com/results?search_query={{{s}}}"
        }
      ]
    });
    
    // Show success message
    document.getElementById('storageDisplay').innerHTML = `
      <div style="padding: 10px; background-color: #e8f5e9; border-radius: 4px; margin: 10px 0;">
        <strong>Test data has been set up in sync storage!</strong>
        <p>Now go to <a href="https://search.cogilabs.eu/" target="_blank">search.cogilabs.eu</a> to trigger the migration.</p>
        <p>The migration should detect conflicts and show the resolution UI.</p>
      </div>
    `;
  } catch (error) {
    alert('Error setting up test: ' + error.message);
    console.error('Setup error:', error);
  }
});

// Add a button to set up local storage directly in the CogiSearch site
document.getElementById('setupLocal').addEventListener('click', async () => {
  try {
    // Find a tab with CogiSearch open
    const tabs = await browserAPI.tabs.query({ url: "https://search.cogilabs.eu/*" });
    
    if (tabs.length > 0) {
      // We have CogiSearch open, inject the local bangs
      console.log("Found CogiSearch tab, injecting local bangs");
      
      // Define bang data outside the function to avoid serialization issues
      const bangData = [
        {
          "d": "google.com",
          "r": 500,
          "s": "g",
          "t": "g",
          "u": "https://google.com/search?q={{{s}}}"
        },
        {
          "d": "wikipedia.org",
          "r": 500,
          "s": "w",
          "t": "w",
          "u": "https://wikipedia.org/wiki/Special:Search?search={{{s}}}"
        }
      ];
      
      // Firefox-compatible script injection
      const result = await browserAPI.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (bangsArray) => {
          // Set up localStorage with test data
          localStorage.setItem('userBangs', JSON.stringify(bangsArray));
          console.log('Local bangs set up in CogiSearch localStorage:', bangsArray);
          return 'Local bangs set up in CogiSearch localStorage';
        },
        args: [bangData]  // Pass bang data as an argument
      });
      
      console.log("Script execution result:", result);
      
      document.getElementById('storageDisplay').innerHTML = `
        <div style="padding: 10px; background-color: #e8f5e9; border-radius: 4px; margin: 10px 0;">
          <strong>Local bangs set up in CogiSearch!</strong>
          <p>Now click "Setup Test Data" to create conflicting sync storage bangs.</p>
        </div>
      `;
    } else {
      // No tab with CogiSearch open, suggest opening one
      if (confirm('No CogiSearch tab found. Open one now?')) {
        await browserAPI.tabs.create({ url: "https://search.cogilabs.eu/" });
        document.getElementById('storageDisplay').innerHTML = `
          <div style="padding: 10px; background-color: #fff3cd; border-radius: 4px; margin: 10px 0;">
            <strong>CogiSearch opened in new tab.</strong>
            <p>Please click this button again once the page has loaded.</p>
          </div>
        `;
      }
    }
  } catch (error) {
    alert('Error setting up local storage: ' + error.message);
    console.error('Setup error:', error);
  }
});

// Add clear storage button functionality
document.getElementById('clearStorage').addEventListener('click', async () => {
  try {
    // Clear extension storage (both local and sync) by setting to empty objects
    await browserAPI.storage.local.remove(['migrationDone', 'userBangs']);
    await browserAPI.storage.sync.remove(['userBangs']);
    
    // Alternative approach if specific keys aren't known:
    // Get all keys first, then remove them
    const localData = await browserAPI.storage.local.get();
    if (Object.keys(localData).length > 0) {
      await browserAPI.storage.local.remove(Object.keys(localData));
    }
    
    const syncData = await browserAPI.storage.sync.get();
    if (Object.keys(syncData).length > 0) {
      await browserAPI.storage.sync.remove(Object.keys(syncData));
    }
    
    // Also clear localStorage userBangs
    localStorage.removeItem('userBangs');
    
    const display = document.getElementById('storageDisplay');
    display.innerHTML = `
      <div style="padding: 10px; background-color: #e8f5e9; border-radius: 4px; margin: 10px 0;">
        Storage cleared successfully!
      </div>
    `;
    
    alert('All storage cleared successfully');
  } catch (error) {
    alert('Error clearing storage: ' + error.message);
    console.error('Clear storage error:', error);
  }
});

// Update showStorage function to properly access website localStorage
document.getElementById('showStorage').addEventListener('click', async () => {
  try {
    // Get data from extension storage
    const local = await browserAPI.storage.local.get();
    const sync = await browserAPI.storage.sync.get();
    
    // Get data from website localStorage using content script injection
    let websiteLocalStorage = '(empty)';
    
    // Find a CogiSearch tab
    const tabs = await browserAPI.tabs.query({ url: "https://search.cogilabs.eu/*" });
    if (tabs.length > 0) {
      // Execute script in the CogiSearch tab to get localStorage
      const result = await browserAPI.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          // Get the userBangs from the website's localStorage
          const userBangs = localStorage.getItem('userBangs');
          return userBangs;
        }
      });
      
      // The result is an array of execution results
      if (result && result[0] && result[0].result) {
        try {
          // Parse the JSON to display it nicely formatted
          websiteLocalStorage = JSON.stringify(JSON.parse(result[0].result), null, 2);
        } catch (e) {
          websiteLocalStorage = result[0].result || '(empty)';
        }
      }
    } else {
      websiteLocalStorage = '(No CogiSearch tab open)';
    }
    
    // Get display element
    const display = document.getElementById('storageDisplay');
    
    // Format the data for display
    display.innerHTML = `
      <h3>Extension Local Storage</h3>
      <pre>${JSON.stringify(local, null, 2) || '(empty)'}</pre>
      
      <h3>Extension Sync Storage</h3>
      <pre>${JSON.stringify(sync, null, 2) || '(empty)'}</pre>
      
      <h3>Website localStorage (userBangs from search.cogilabs.eu)</h3>
      <pre>${websiteLocalStorage}</pre>
    `;
    
    console.log('Current storage state:', { local, sync, websiteLocalStorage });
  } catch (error) {
    console.error('Error displaying storage:', error);
    const display = document.getElementById('storageDisplay');
    display.innerHTML = `
      <div style="padding: 10px; background-color: #ffebee; border-radius: 4px; margin: 10px 0;">
        Error displaying storage: ${error.message}
      </div>
    `;
    alert('Error displaying storage: ' + error.message);
  }
});

// Add button to open CogiSearch
document.getElementById('openSite').addEventListener('click', async () => {
  try {
    await browserAPI.tabs.create({ url: "https://search.cogilabs.eu/" });
  } catch (error) {
    alert('Error opening CogiSearch: ' + error.message);
  }
});

// Add testing workflow guidance
document.getElementById('showGuide').addEventListener('click', () => {
  document.getElementById('storageDisplay').innerHTML = `
    <div style="padding: 15px; background-color: #f8f9fa; border-radius: 4px; margin: 10px 0; line-height: 1.5;">
      <h3>How to Test Bang Conflict Resolution</h3>
      
      <ol>
        <li><strong>Clear all storage</strong> to start fresh</li>
        <li><strong>Open CogiSearch</strong> in a new tab</li>
        <li><strong>Set up local bangs</strong> on the CogiSearch website</li>
        <li><strong>Set up sync storage</strong> with conflicting bangs</li>
        <li><strong>Reload the CogiSearch tab</strong> to trigger migration</li>
        <li>Observe the conflict resolution UI</li>
        <li>Choose your preferred bangs</li>
        <li>Check the result with "Show Current Storage"</li>
      </ol>
      
      <p>When migration is complete, the resolution UI should show up if there are conflicts.</p>
    </div>
  `;
});