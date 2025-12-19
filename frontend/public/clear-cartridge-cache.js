/**
 * Cartridge Controller Cache Clearing Utility
 * 
 * Run this in the browser console on your deployed site to clear all Cartridge storage
 * 
 * Usage:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Or visit: https://your-site.onrender.com/clear-cartridge-cache.js
 */

(function clearCartridgeCache() {
  console.log('🧹 Clearing Cartridge Controller storage...');
  
  let cleared = 0;
  
  // Clear localStorage
  try {
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach(key => {
      if (key.includes('cartridge') || key.includes('controller') || key.includes('starknet')) {
        localStorage.removeItem(key);
        cleared++;
      }
    });
    console.log(`✅ Cleared ${cleared} localStorage items`);
  } catch (e) {
    console.warn('⚠️ localStorage clear failed:', e);
  }
  
  // Clear sessionStorage
  try {
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorageKeys.forEach(key => {
      if (key.includes('cartridge') || key.includes('controller') || key.includes('starknet')) {
        sessionStorage.removeItem(key);
        cleared++;
      }
    });
    console.log(`✅ Cleared sessionStorage items`);
  } catch (e) {
    console.warn('⚠️ sessionStorage clear failed:', e);
  }
  
  // Clear IndexedDB
  try {
    indexedDB.databases().then(dbs => {
      const cartridgeDbs = dbs.filter(db => 
        db.name.toLowerCase().includes('cartridge') || 
        db.name.toLowerCase().includes('controller') ||
        db.name.toLowerCase().includes('starknet')
      );
      
      if (cartridgeDbs.length > 0) {
        cartridgeDbs.forEach(db => {
          console.log(`🗑️ Deleting IndexedDB: ${db.name}`);
          indexedDB.deleteDatabase(db.name);
          cleared++;
        });
        console.log(`✅ Cleared ${cartridgeDbs.length} IndexedDB databases`);
      } else {
        console.log('ℹ️ No Cartridge-related IndexedDB databases found');
      }
      
      console.log(`\n🎉 Total items cleared: ${cleared}`);
      console.log('🔄 Reloading page in 2 seconds...');
      setTimeout(() => {
        location.reload();
      }, 2000);
    }).catch(e => {
      console.warn('⚠️ IndexedDB clear failed:', e);
      console.log('🔄 Reloading page anyway...');
      setTimeout(() => {
        location.reload();
      }, 2000);
    });
  } catch (e) {
    console.warn('⚠️ IndexedDB not available:', e);
    console.log('🔄 Reloading page...');
    setTimeout(() => {
      location.reload();
    }, 2000);
  }
})();

