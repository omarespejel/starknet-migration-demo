# Security Audit Fixes

## ✅ Fixed Issues

### Critical Issues

1. **✅ Test vs Production Merkle Tree Mismatch**
   - Updated `page.tsx` hardcoded address to match merkle tree
   - Address now: `0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152`

2. **✅ Package.json Dependencies**
   - Already includes all MetaMask dependencies:
     - `wagmi: ^2.19.5`
     - `viem: ^2.43.2`
     - `@rainbow-me/rainbowkit: ^2.2.10`
     - `@tanstack/react-query: ^5.90.12`

3. **✅ Test Mock Path Inconsistency**
   - Fixed test to expect `/merkle-tree.json` (matches actual code)

### Medium Issues

4. **✅ Rate Limiting on Merkle Fetch**
   - Added 300ms debounce to prevent rapid-fire requests

5. **✅ Exposed RPC Keys**
   - Created `snfoundry.example.toml` with environment variable pattern
   - Documented: Use `STARKNET_RPC_URL` environment variable

6. **✅ Hardcoded Starkscan URL**
   - Created `getStarkscanUrl()` helper function
   - Network-aware (mainnet vs sepolia)

7. **✅ Console Logs in Production**
   - Wrapped all `console.log/error` in `process.env.NODE_ENV === 'development'` checks

### Minor Issues

8. **✅ Missing Error Boundary**
   - Created `ErrorBoundary` component
   - Wrapped providers in `layout.tsx`
   - Graceful error handling with retry option

## ⚠️ Documented Limitations

### Signature Verification

**Status:** ETH signature is collected for UX but **not verified on-chain**

**Current Behavior:**
- Portal contract only verifies merkle proof
- Signature proves ETH ownership to user, but contract doesn't check it

**Risk:** Anyone with a valid Starknet address in merkle tree can claim without proving ETH ownership

**Recommendations:**
1. **For Production:** Implement backend API that:
   - Verifies ETH signature server-side
   - Only returns merkle proof if signature is valid
   - Prevents proof disclosure without signature verification

2. **For Demo:** Current implementation is acceptable - signature serves as UX proof

**Example Backend Flow:**
```typescript
POST /api/verify-and-get-proof
{
  "ethAddress": "0x...",
  "starknetAddress": "0x...",
  "signature": "0x...",
  "message": "..."
}

// Backend verifies signature, then returns proof
Response: {
  "amount": "...",
  "proof": ["0x...", "0x..."]
}
```

### Single-Leaf Merkle Tree

**Status:** Demo merkle tree has only 1 claim

**Current State:**
- `public/merkle-tree.json` contains single address
- Empty proof `[]` is valid for single-leaf tree

**Action Required for Production:**
- Generate multi-user merkle tree from real snapshot
- Use proper merkle tree generation script with multiple addresses

## Pre-Launch Checklist

- [x] Fix hardcoded address in page.tsx
- [x] Verify package.json has all dependencies
- [x] Fix test mock path
- [x] Add debounce to merkle fetch
- [x] Create snfoundry.example.toml
- [x] Make Starkscan URL network-aware
- [x] Wrap console.logs in dev checks
- [x] Add ErrorBoundary component
- [ ] Generate production merkle tree (multi-user)
- [ ] Move RPC URL to environment variable (deployment step)
- [ ] Implement backend signature verification (production only)
- [ ] Run full test suite: `cd frontend && bun test`
- [ ] Run contract tests: `cd contracts && snforge test`

## Environment Variables Required

### Frontend (.env.local)
```env
NEXT_PUBLIC_WALLETCONNECT_ID=your_project_id
NEXT_PUBLIC_PORTAL_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_NETWORK=sepolia
```

### Contracts (deployment)
```bash
export STARKNET_RPC_URL="https://starknet-sepolia.g.alchemy.com/..."
```

## Risk Assessment

| Deployment | Risk Level | Notes |
|------------|------------|-------|
| **Testnet Demo** | 🟢 Low | All critical fixes applied |
| **Mainnet (limited)** | 🟡 Medium | Need production merkle tree |
| **Mainnet (production)** | 🟡 Medium | Need backend signature verification |

