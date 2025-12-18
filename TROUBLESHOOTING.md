# Troubleshooting Cartridge Controller Connection Issues

## Common Error: "Timeout waiting for keychain"

This error occurs when the Cartridge Controller keychain iframe is blocked by browser security policies.

## Quick Fixes (Try in Order)

### 1. Test in Incognito Mode (No Extensions)

**Chrome:**
```bash
google-chrome --incognito http://localhost:3000
```

**Firefox:**
```bash
firefox --private-window http://localhost:3000
```

**Important:** Disable ALL browser extensions in incognito mode.

### 2. Disable Browser Extensions

Common culprits:
- **Ad blockers** (uBlock Origin, AdBlock Plus)
- **Privacy tools** (Privacy Badger, Ghostery)
- **MetaMask** (can conflict with Cartridge)

**To disable:**
1. Go to `chrome://extensions/` (Chrome) or `about:addons` (Firefox)
2. Toggle off extensions one by one
3. Refresh the page and test

### 3. Check Popup Blocker

Look for a **popup blocked icon** in the address bar when clicking "Connect Controller".

**To allow:**
- Click the popup icon → Always allow popups from localhost:3000

### 4. Try Different Browser

If Chrome has issues, try:
- **Firefox** (fresh profile)
- **Brave** (disable shields for localhost)
- **Edge** (no extensions)

## Diagnostic Steps

### Step 1: Check Cartridge Keychain URL

Open in a new tab:
```
https://x.cartridge.gg
```

You should see a Cartridge page (not an error).

### Step 2: Check Network Tab

1. Open DevTools → **Network** tab
2. Click "Connect Controller"
3. Look for **blocked requests** (red) to:
   - `x.cartridge.gg`
   - `api.cartridge.gg`

### Step 3: Check Console Errors

Look for:
- `Content Security Policy directive` errors
- `iframe` blocked errors
- `WASM` runtime errors

## CSP Headers Added

The `next.config.js` now includes Content Security Policy headers that allow:
- Cartridge domains (`x.cartridge.gg`, `*.cartridge.gg`)
- WASM modules
- WebSocket connections
- Frame embedding

**After updating `next.config.js`, restart the dev server:**
```bash
# Stop current server (Ctrl+C)
cd frontend && npm run dev
```

## Expected Console Output (Success)

```
✅ [INIT] ControllerConnector created: controller
🔧 [MOUNT] Client mounted, connector: controller
✅ Cartridge RPC reachable, chain: 0x534e5f5345504f4c4941
```

## If Still Not Working

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** (Ctrl+Shift+R / Cmd+Shift+R)
3. **Check firewall/antivirus** - may block iframe connections
4. **Try different network** - corporate networks may block iframes

## Alternative: Test with Argent X First

While debugging Cartridge, you can test the claim flow with Argent X:
1. Install Argent X extension
2. Connect with Argent X
3. Test claim flow
4. This verifies the contract works while Cartridge is being debugged
