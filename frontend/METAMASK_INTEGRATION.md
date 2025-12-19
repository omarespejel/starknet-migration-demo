# MetaMask Integration Guide

## Overview

This integration adds MetaMask support alongside Cartridge Controller, enabling a **Transfer-then-Claim** migration flow where users:

1. Connect MetaMask (Ethereum/IMX wallet)
2. Sign a migration authorization message
3. Connect Cartridge Controller (Starknet wallet)
4. Claim tokens on Starknet using merkle proof

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
├──────────────────────────────────────────────────────────────┤
│  EthProviders (wagmi + RainbowKit)                           │
│    └─ StarknetProviders (starknet-react + Cartridge)         │
│         └─ MigrationPage                                      │
│              ├─ Step 1: MetaMask connect + sign              │
│              ├─ Step 2: Controller connect                    │
│              └─ Step 3: Claim with merkle proof              │
└──────────────────────────────────────────────────────────────┘
```

## Installed Packages

- `wagmi@^2.9.0` - React hooks for Ethereum
- `viem@^2.43.2` - TypeScript Ethereum client
- `@rainbow-me/rainbowkit@^2.2.10` - Wallet connection UI
- `@tanstack/react-query@^5.90.12` - Required peer dependency

## Files Created/Modified

### New Files

1. **`app/eth-providers.tsx`**
   - Sets up wagmi + RainbowKit providers
   - Configures WalletConnect for MetaMask

2. **`app/migrate/page.tsx`**
   - Main migration flow component
   - Handles both MetaMask and Cartridge Controller connections
   - Implements 3-step migration process

3. **`lib/merkle.ts`**
   - Utilities for fetching merkle tree allocations
   - Address normalization helpers

4. **`lib/constants.ts`**
   - Centralized contract addresses and constants

### Modified Files

1. **`app/layout.tsx`**
   - Added `EthProviders` wrapper around `Providers`
   - Nested provider structure: `EthProviders` → `StarknetProviders`

2. **`app/page.tsx`**
   - Added navigation link to new migration flow

## Setup Instructions

### 1. Get WalletConnect Project ID

1. Go to [cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Create a new project
3. Copy the Project ID

### 2. Configure Environment Variables

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_WALLETCONNECT_ID=your_project_id_here
NEXT_PUBLIC_PORTAL_ADDRESS=0x027d9db485a394d3aea0c3af6a82b889cb95a833cc4fe36ede8696624f0310fb
NEXT_PUBLIC_TOKEN_ADDRESS=0x07ef08eb2287fe9a996bb3de1e284b595fab5baae51374e0d8fc088c2d4334c9
NEXT_PUBLIC_NETWORK=sepolia
```

### 3. Run Development Server

```bash
cd frontend
bun run dev
```

Visit:
- Main page: `http://localhost:3000` (original Cartridge-only flow)
- Migration page: `http://localhost:3000/migrate` (MetaMask + Controller flow)

## Migration Flow

### Step 1: Connect MetaMask & Sign

- User clicks "Connect Wallet" (RainbowKit button)
- MetaMask popup appears
- User connects their Ethereum/IMX wallet
- User signs migration authorization message
- Signature proves ownership of ETH/IMX address

### Step 2: Connect Cartridge Controller

- User clicks "Connect Controller (Passkey)"
- Cartridge Controller popup appears
- User authenticates with passkey (no seed phrase!)
- Creates/connects Starknet wallet

### Step 3: Claim Tokens

- Frontend fetches merkle proof for Starknet address
- User clicks "Claim Tokens"
- Portal contract verifies proof and mints tokens
- Transaction submitted to Starknet

## Signature Message Format

```typescript
GGMT Token Migration Authorization

I authorize the migration of my GGMT tokens from IMX to Starknet.

IMX Address: 0x...
Starknet Address: 0x...
Timestamp: 1234567890

This signature proves ownership and authorizes the claim.
```

## Backend Integration (Future)

For production, you'll need a backend API that:

1. **Verifies ETH signature** - Confirms user owns the ETH/IMX address
2. **Looks up allocation** - Finds user's allocation in merkle tree
3. **Returns proof** - Provides merkle proof for Starknet claim

Example endpoint:

```typescript
POST /api/verify-and-get-proof
{
  "ethAddress": "0x...",
  "starknetAddress": "0x...",
  "signature": "0x...",
  "message": "..."
}

Response:
{
  "amount": "1000000000000000000",
  "proof": ["0x...", "0x..."]
}
```

## Key Hooks Used

### Ethereum Side

```tsx
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const { address: ethAddress, isConnected } = useAccount();
const { signMessage } = useSignMessage();
```

### Starknet Side

```tsx
import { useAccount, useConnect } from "@starknet-react/core";

const { address: starknetAddress, account } = useAccount();
const { connect, connectors } = useConnect();
const controller = connectors.find(c => c.id === "controller");
```

## Testing

1. **Test MetaMask Connection**
   - Click "Connect Wallet"
   - Verify MetaMask popup appears
   - Connect wallet

2. **Test Signature**
   - Click "Sign Migration Authorization"
   - Verify MetaMask signature popup
   - Sign message
   - Verify signature is captured

3. **Test Controller Connection**
   - Click "Connect Controller"
   - Verify Cartridge popup appears
   - Authenticate with passkey
   - Verify Starknet address is captured

4. **Test Claim**
   - Verify merkle proof is fetched
   - Click "Claim Tokens"
   - Verify transaction is submitted
   - Check transaction hash on Starkscan

## Troubleshooting

### WalletConnect Project ID Missing

Error: `NEXT_PUBLIC_WALLETCONNECT_ID is required`

**Solution**: Add `NEXT_PUBLIC_WALLETCONNECT_ID` to `.env.local`

### wagmi Version Mismatch

Error: Peer dependency warnings

**Solution**: Ensure `wagmi@^2.9.0` is installed (compatible with RainbowKit)

### MetaMask Not Detected

**Solution**: 
- Install MetaMask browser extension
- Refresh page
- Check browser console for errors

## Next Steps

1. **Backend API** - Implement signature verification and merkle proof lookup
2. **Error Handling** - Add better error messages and retry logic
3. **Loading States** - Improve UX with loading indicators
4. **Transaction Status** - Show transaction status and confirmations
5. **Multi-chain Support** - Add support for other EVM chains (Polygon, Arbitrum, etc.)

## Resources

- [wagmi Documentation](https://wagmi.sh)
- [RainbowKit Documentation](https://www.rainbowkit.com)
- [WalletConnect Cloud](https://cloud.walletconnect.com)
- [Cartridge Controller Docs](https://docs.cartridge.gg)

