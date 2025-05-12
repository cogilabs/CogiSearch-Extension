// Toggle debug panel visibility
document.getElementById('toggleDebug').addEventListener('click', () => {
  const panel = document.getElementById('debugPanel');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    // Auto-refresh data when panel opens
    document.getElementById('debugStorage').click();
  } else {
    panel.style.display = 'none';
  }
});

// Add debug button functionality
document.getElementById('debugStorage').addEventListener('click', async () => {
  const debugResult = document.getElementById('debugResult');
  debugResult.innerHTML = '<p>Chargement des données...</p>';
  
  try {
    // Check browser.storage.sync
    const syncResult = await browser.storage.sync.get('userBangs');
    const syncBangs = syncResult.userBangs || [];
    
    // Check browser.storage.local
    const localResult = await browser.storage.local.get('userBangs');
    const localBangs = localResult.userBangs || [];
    
    // Check if migration is done
    const { migrationDone } = await browser.storage.local.get('migrationDone');
    
    // Check localStorage (need to use content script)
    browser.tabs.query({ url: "https://search.cogilabs.eu/*" }).then(tabs => {
      if (tabs.length > 0) {
        browser.tabs.sendMessage(tabs[0].id, { action: "checkLocalStorage" })
          .then(response => {
            const localStorageBangs = response && response.userBangs ? 
              JSON.parse(response.userBangs) : [];
            
            updateDebugOutput(syncBangs, localBangs, localStorageBangs, migrationDone);
          })
          .catch(err => {
            console.error("Error checking localStorage:", err);
            updateDebugOutput(syncBangs, localBangs, 'Page not open or error: ' + err.message, migrationDone);
          });
      } else {
        updateDebugOutput(syncBangs, localBangs, 'Page not open', migrationDone);
      }
    });
  } catch (error) {
    console.error("Error accessing storage:", error);
    debugResult.innerHTML = `<p class="error">Error accessing storage: ${error.message}</p>`;
  }
});

function updateDebugOutput(syncBangs, localBangs, localStorageBangs, migrationDone) {
  const debugResult = document.getElementById('debugResult');
  
  let html = '<h3>Storage Diagnosis</h3>';
  
  // Migration status
  html += '<div class="storage-section">';
  html += '<h4>Migration Status:</h4>';
  if (migrationDone) {
    html += '<p class="found">Migration has been completed</p>';
  } else {
    html += '<p class="warning">Migration has not yet been completed</p>';
  }
  html += '</div>';
  
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
      html += `<li>...et ${syncBangs.length - 5} autres</li>`;
    }
    html += '</ul>';
  } else {
    html += '<p class="not-found">Aucun bang trouvé</p>';
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
      html += `<li>...et ${localBangs.length - 3} autres</li>`;
    }
    html += '</ul>';
  } else {
    html += '<p class="not-found">Aucun bang trouvé</p>';
  }
  html += '</div>';
  
  // Website localStorage
  html += '<div class="storage-section">';
  html += '<h4>localStorage du site web:</h4>';
  if (Array.isArray(localStorageBangs) && localStorageBangs.length > 0) {
    html += `<p class="found">${localStorageBangs.length} bangs found</p>`;
    html += '<ul>';
    localStorageBangs.slice(0, 3).forEach(bang => {
      html += `<li>!${bang.t} → ${bang.u.substring(0, 30)}...</li>`;
    });
    if (localStorageBangs.length > 3) {
      html += `<li>...et ${localStorageBangs.length - 3} autres</li>`;
    }
    html += '</ul>';
  } else if (typeof localStorageBangs === 'string') {
    html += `<p class="warning">${localStorageBangs}</p>`;
  } else {
    html += '<p class="not-found">Aucun bang trouvé</p>';
  }
  html += '</div>';
  
  html += '<p class="info">Ces données montrent où vos bangs sont stockés actuellement.</p>';
  
  html += '<div class="debug-actions">';
  html += '<button id="forceSync" class="small-button">Force extension → page</button>';
  html += '<button id="forceLoad" class="small-button">Force page → extension</button>';
  html += '<button id="resetMigration" class="small-button">Réinitialiser migration</button>';
  html += '</div>';
  
  debugResult.innerHTML = html;
  
  // Add event listener to the force sync button (extension to page)
  document.getElementById('forceSync').addEventListener('click', async () => {
    try {
      // Send message to force sync from browser.storage.sync to localStorage on the page
      const tabs = await browser.tabs.query({ url: "https://search.cogilabs.eu/*" });
      
      if (tabs.length > 0) {
        await browser.tabs.sendMessage(tabs[0].id, { action: "forceSync" });
        alert('Synchronisation forcée (extension → page)! Vérifiez à nouveau pour confirmer.');
        
        // Refresh the debug display
        document.getElementById('debugStorage').click();
      } else {
        alert('La page CogiSearch doit être ouverte pour forcer la synchronisation. Ouvrez CogiSearch puis réessayez.');
      }
    } catch (error) {
      console.error("Force sync error:", error);
      alert(`Erreur lors de la synchronisation: ${error.message}`);
    }
  });
  
  // Add event listener to force load button (page to extension)
  document.getElementById('forceLoad').addEventListener('click', async () => {
    try {
      const tabs = await browser.tabs.query({ url: "https://search.cogilabs.eu/*" });
      
      if (tabs.length > 0) {
        const response = await browser.tabs.sendMessage(tabs[0].id, { action: "checkLocalStorage" });
        
        if (response && response.userBangs) {
          const bangs = JSON.parse(response.userBangs);
          await browser.storage.sync.set({ userBangs: bangs });
          alert(`Synchronisation forcée (page → extension)! ${bangs.length} bangs importés.`);
          
          // Refresh the debug display
          document.getElementById('debugStorage').click();
        } else {
          alert('Aucun bang trouvé dans le localStorage de la page.');
        }
      } else {
        alert('La page CogiSearch doit être ouverte pour importer les bangs. Ouvrez CogiSearch puis réessayez.');
      }
    } catch (error) {
      console.error("Force load error:", error);
      alert(`Erreur lors de l'importation: ${error.message}`);
    }
  });
  
  // Add event listener to reset migration button
  document.getElementById('resetMigration').addEventListener('click', async () => {
    try {
      await browser.storage.local.set({ migrationDone: false });
      alert('Migration réinitialisée! La prochaine fois que vous visiterez CogiSearch, la migration sera effectuée à nouveau.');
      
      // Refresh the debug display
      document.getElementById('debugStorage').click();
    } catch (error) {
      console.error("Reset migration error:", error);
      alert(`Erreur lors de la réinitialisation de la migration: ${error.message}`);
    }
  });
}