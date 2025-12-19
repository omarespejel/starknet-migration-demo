# Cartridge Controller Customization Guide

## Available Customization Options

### Theme Selection

The Cartridge Controller supports several built-in themes. You can change the theme in `frontend/app/providers.tsx`:

```typescript
const ctrl = new ControllerConnector({
  // ... other config
  
  theme: "dope-wars",  // Current theme
});
```

### Available Themes

1. **`"dope-wars"`** (Current)
   - Dark gaming aesthetic
   - Purple/blue color scheme
   - Best for: Gaming, DeFi, NFT projects

2. **`"cartridge"`** (Default)
   - Clean Cartridge branding
   - Professional look
   - Best for: Enterprise, professional apps

3. **`"degen"`**
   - Degen/crypto vibe
   - Bold colors
   - Best for: Meme coins, community projects

4. **`"slot"`**
   - Slot machine theme
   - Fun, playful aesthetic
   - Best for: Gaming, entertainment

### Other Customization Options

```typescript
const ctrl = new ControllerConnector({
  // 🎨 Theme
  theme: "dope-wars",  // or "cartridge", "degen", "slot"
  
  // 🌓 Color mode
  colorMode: "dark",   // or "light"
  
  // 🔐 Authentication options
  signupOptions: ["webauthn", "google"],
  // Available: "webauthn" (passkey), "google", "twitter", "github"
  
  // 🌐 URLs
  url: "https://x.cartridge.gg",           // Keychain URL
  redirectUrl: window.location.origin,     // Redirect after auth
  
  // ⚙️ Behavior
  propagateSessionErrors: true,
});
```

## What You CANNOT Customize

For security reasons, Cartridge Controller does NOT allow customization of:

- ❌ Popup colors (specific hex codes)
- ❌ Layout/positioning
- ❌ Fonts
- ❌ Button styles inside the iframe
- ❌ Logo/branding (beyond theme selection)

This is intentional security design to prevent phishing attacks where malicious sites could fake Cartridge UI.

## Testing Different Themes

1. Edit `frontend/app/providers.tsx`
2. Change the `theme` value
3. Test locally or deploy to see changes

## Clearing Browser Cache

If you need to clear Cartridge storage (e.g., after testing different themes):

### Method 1: Browser Console Script

Run this in the browser console:

```javascript
// Clear all Cartridge storage
localStorage.clear();
sessionStorage.clear();
indexedDB.databases().then(dbs => {
  dbs.forEach(db => {
    console.log('Deleting:', db.name);
    indexedDB.deleteDatabase(db.name);
  });
  console.log('✅ Storage cleared! Reloading...');
  setTimeout(() => location.reload(), 1000);
});
```

### Method 2: Browser DevTools

1. Right-click → Inspect
2. Go to **Application** tab
3. Click **Clear site data**
4. Check all boxes
5. Click **Clear**

### Method 3: Use the Utility Script

A utility script is available at `/clear-cartridge-cache.js` (in the public folder).

## Current Configuration

See `frontend/app/providers.tsx` for the current configuration.

