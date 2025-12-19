// clear cartridge controller cache
// run this in browser console (F12) to clear all cartridge storage
// or just visit the /clear-cartridge-cache.js url

(function clearCartridgeCache() {
  console.log('Clearing Cartridge Controller storage...');
  
  let cleared = 0;
  
  // clear localStorage
  try {
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach(key => {
      if (key.includes('cartridge') || key.includes('controller') || key.includes('starknet')) {
        localStorage.removeItem(key);
        cleared++;
      }
    });
    console.log(`Cleared ${cleared} localStorage items`);
  } catch (e) {
    console.warn('localStorage clear failed:', e);
  }
  
  // clear sessionStorage
  try {
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorageKeys.forEach(key => {
      if (key.includes('cartridge') || key.includes('controller') || key.includes('starknet')) {
        sessionStorage.removeItem(key);
        cleared++;
      }
    });
    console.log('Cleared sessionStorage items');
  } catch (e) {
    console.warn('sessionStorage clear failed:', e);
  }
  
  // clear indexedDB
  try {
    indexedDB.databases().then(dbs => {
      const cartridgeDbs = dbs.filter(db => 
        db.name.toLowerCase().includes('cartridge') || 
        db.name.toLowerCase().includes('controller') ||
        db.name.toLowerCase().includes('starknet')
      );
      
      if (cartridgeDbs.length > 0) {
        cartridgeDbs.forEach(db => {
          console.log(`Deleting IndexedDB: ${db.name}`);
          indexedDB.deleteDatabase(db.name);
          cleared++;
        });
        console.log(`Cleared ${cartridgeDbs.length} IndexedDB databases`);
      } else {
        console.log('No Cartridge-related IndexedDB databases found');
      }
      
      console.log(`\nTotal items cleared: ${cleared}`);
      console.log('Reloading page in 2 seconds...');
      setTimeout(() => {
        location.reload();
      }, 2000);
    }).catch(e => {
      console.warn('IndexedDB clear failed:', e);
      console.log('Reloading page anyway...');
      setTimeout(() => {
        location.reload();
      }, 2000);
    });
  } catch (e) {
    console.warn('IndexedDB not available:', e);
    console.log('Reloading page...');
    setTimeout(() => {
      location.reload();
    }, 2000);
  }
})();

