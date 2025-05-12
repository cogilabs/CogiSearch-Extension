// Event listeners for buttons

document.getElementById('openInstructions').addEventListener('click', () => {
  browser.tabs.create({ url: 'instructions.html' });
});

document.getElementById('manageSettings').addEventListener('click', () => {
  browser.tabs.create({ url: 'https://search.cogilabs.eu/#settings-title' });
});

// Add debug button functionality if present
if (document.getElementById('debugStorage')) {
  document.getElementById('debugStorage').addEventListener('click', async () => {
    const debugResult = document.getElementById('debugResult');
    
    try {
      // Check browser.storage.sync
      const syncResult = await browser.storage.sync.get('userBangs');
      const syncBangs = syncResult.userBangs || [];
      
      // Check browser.storage.local
      const localResult = await browser.storage.local.get('userBangs');
      const localBangs = localResult.userBangs || [];
      
      // Check localStorage (need to use content script)
      browser.tabs.query({ url: "https://search.cogilabs.eu/*" }).then(tabs => {
        if (tabs.length > 0) {
          browser.tabs.sendMessage(tabs[0].id, { action: "checkLocalStorage" })
            .then(response => {
              const localStorageBangs = response && response.userBangs ? 
                JSON.parse(response.userBangs) : [];
              
              updateDebugOutput(syncBangs, localBangs, localStorageBangs);
            })
            .catch(err => {
              updateDebugOutput(syncBangs, localBangs, 'Page not open or error');
            });
        } else {
          updateDebugOutput(syncBangs, localBangs, 'Page not open');
        }
      });
    } catch (error) {
      debugResult.innerHTML = `<p class="error">Error accessing storage: ${error.message}</p>`;
    }
  });
}

function updateDebugOutput(syncBangs, localBangs, localStorageBangs) {
  const debugResult = document.getElementById('debugResult');
  
  let html = '<h3>Storage Diagnosis</h3>';
  
  // Extension sync storage
  html += '<div class="storage-section">';
  html += '<h4>Extension Sync Storage:</h4>';
  if (Array.isArray(syncBangs) && syncBangs.length > 0) {
    html += `<p class="found">${syncBangs.length} bangs found</p>`;
    html += '<ul>';
    syncBangs.slice(0, 5).forEach(bang => {
      html += `<li>!${bang.t} → ${bang.u.substring(0, 30)}...</li>`;
    });
    if (syncBangs.length > 5) {
      html += `<li>...and ${syncBangs.length - 5} more</li>`;
    }
    html += '</ul>';
  } else {
    html += '<p class="not-found">No bangs found</p>';
  }
  html += '</div>';
  
  // Extension local storage
  html += '<div class="storage-section">';
  html += '<h4>Extension Local Storage:</h4>';
  if (Array.isArray(localBangs) && localBangs.length > 0) {
    html += `<p class="found">${localBangs.length} bangs found</p>`;
    html += '<ul>';
    localBangs.slice(0, 3).forEach(bang => {
      html += `<li>!${bang.t} → ${bang.u.substring(0, 30)}...</li>`;
    });
    if (localBangs.length > 3) {
      html += `<li>...and ${localBangs.length - 3} more</li>`;
    }
    html += '</ul>';
  } else {
    html += '<p class="not-found">No bangs found</p>';
  }
  html += '</div>';
  
  // Website localStorage
  html += '<div class="storage-section">';
  html += '<h4>Website localStorage:</h4>';
  if (Array.isArray(localStorageBangs) && localStorageBangs.length > 0) {
    html += `<p class="found">${localStorageBangs.length} bangs found</p>`;
    html += '<ul>';
    localStorageBangs.slice(0, 3).forEach(bang => {
      html += `<li>!${bang.t} → ${bang.u.substring(0, 30)}...</li>`;
    });
    if (localStorageBangs.length > 3) {
      html += `<li>...and ${localStorageBangs.length - 3} more</li>`;
    }
    html += '</ul>';
  } else if (typeof localStorageBangs === 'string') {
    html += `<p class="warning">${localStorageBangs}</p>`;
  } else {
    html += '<p class="not-found">No bangs found</p>';
  }
  html += '</div>';
  
  html += '<p class="info">Ces données montrent où vos bangs sont stockés actuellement.</p>';
  html += '<button id="forceSync" class="small-button">Forcer la synchronisation</button>';
  
  debugResult.innerHTML = html;
  
  // Add event listener to the force sync button
  document.getElementById('forceSync').addEventListener('click', async () => {
    try {
      // Send message to force sync from browser.storage.sync to localStorage on the page
      const tabs = await browser.tabs.query({ url: "https://search.cogilabs.eu/*" });
      
      if (tabs.length > 0) {
        await browser.tabs.sendMessage(tabs[0].id, { action: "forceSync" });
        alert('Synchronisation forcée! Vérifiez à nouveau pour confirmer.');
        
        // Refresh the debug display
        document.getElementById('debugStorage').click();
      } else {
        alert('La page CogiSearch doit être ouverte pour forcer la synchronisation. Ouvrez CogiSearch puis réessayez.');
      }
    } catch (error) {
      alert(`Erreur lors de la synchronisation: ${error.message}`);
    }
  });
}