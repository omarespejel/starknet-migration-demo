# Frontend Architecture: Token Migration Portal

This document explains how the frontend works, why we made certain design decisions, and what advantages Cartridge Controller provides.

## Overview

The migration portal uses a dual-wallet architecture: users connect both an Ethereum wallet (MetaMask) and a Starknet wallet (Cartridge Controller) to migrate tokens from L1 to Starknet. This design solves a fundamental problem: proving ownership on one chain and executing on another.

## Architecture Components

### Provider Stack

The application uses a nested provider architecture:

```
ErrorBoundary
└── EthProviders (wagmi + RainbowKit)
    └── Providers (Starknet React + Cartridge Controller)
        └── Page Component
```

**Why this order?** Ethereum providers wrap Starknet providers because:
1. The Ethereum connection happens first (Step 1)
2. The signature message includes both addresses
3. Starknet execution depends on Ethereum signature verification

### Dual-Wallet Flow

The migration requires two wallets for different purposes:

**Ethereum Wallet (MetaMask):**
- Purpose: Prove ownership of L1 tokens
- Action: Sign a message authorizing migration
- Why: The merkle tree snapshot uses Ethereum addresses

**Starknet Wallet (Cartridge Controller):**
- Purpose: Receive migrated tokens
- Action: Execute the claim transaction
- Why: Tokens are minted on Starknet, not transferred

## Why Cartridge Controller?

Cartridge Controller solves three critical UX problems in Starknet:

### 1. Gasless Transactions

Traditional Starknet wallets require users to pay gas fees for every transaction. Cartridge Controller uses session keys—temporary signing keys that are pre-authorized for specific contract methods. When a user creates a session, they approve a policy that allows gasless transactions for the `claim` function.

**How it works:**
- User connects once and approves a session policy
- Session keys are stored securely in Cartridge's keychain
- Future transactions matching the policy execute without user interaction
- No gas fees are charged to the user

**Code location:** `providers.tsx` lines 19-38 define the session policies.

### 2. Passkey Authentication

Instead of managing seed phrases or private keys, Cartridge Controller uses WebAuthn passkeys. Users authenticate with biometrics (fingerprint, face ID) or a hardware security key.

**Advantages:**
- No seed phrase to lose or compromise
- Hardware-backed security
- Cross-device synchronization
- Familiar authentication method

**Code location:** `providers.tsx` line 83 configures signup options.

### 3. Invisible Wallet Experience

After the initial connection, Cartridge Controller operates invisibly. Users don't see popups or confirmation dialogs for transactions that match approved policies. The transaction executes automatically.

**User experience:**
1. First connection: User approves passkey and session policy (one-time)
2. Subsequent claims: Click "Claim Tokens" → transaction executes automatically
3. No popups, no confirmations, no gas fees

## Migration Flow Explained

### Step 1: Connect L1 Wallet

**What happens:**
- User connects MetaMask via RainbowKit
- Application reads the Ethereum address
- Merkle tree lookup begins using the ETH address

**Why ETH address?** The migration snapshot is based on L1 addresses. Eligibility is determined by checking if the connected Ethereum address exists in the merkle tree.

**Code:** `page.tsx` lines 72-109 handle eligibility checking.

### Step 2: Connect Starknet Wallet & Sign

**What happens:**
- User connects Cartridge Controller (passkey authentication)
- Application reads the Starknet address
- User signs a message in MetaMask that includes both addresses

**Why sign a message?** The signature proves:
1. The user controls the Ethereum address (from the snapshot)
2. The user authorizes migration to the specific Starknet address
3. The signature can be verified on-chain (in production, via backend)

**Code:** `page.tsx` lines 127-138 handle message signing.

### Step 3: Claim Tokens

**What happens:**
- Application prepares calldata: amount (u256) + merkle proof
- Calls `account.execute()` on the portal contract
- Cartridge Controller executes the transaction using session keys
- Transaction is gasless and invisible to the user

**Technical details:**
- Amount is split into low/high u256 components (lines 191-194)
- Merkle proof is passed as an array of felt252 values
- The portal contract verifies the proof and mints tokens

**Code:** `page.tsx` lines 159-251 handle the claim transaction.

## Merkle Tree Lookup

The merkle tree is a cryptographic data structure that allows efficient proof verification. Instead of storing all eligible addresses on-chain, we store only the root hash. Users provide proofs that their address is in the tree.

**How it works:**
1. Snapshot is taken of all eligible L1 addresses and amounts
2. Merkle tree is generated with these addresses as leaves
3. Root hash is stored in the portal contract
4. Users fetch their proof from `merkle-tree.json`
5. Portal contract verifies the proof against the root

**Code:** `lib/merkle.ts` handles fetching and lookup.

## State Management

The application uses React hooks for state management:

**Local State (useState):**
- Migration step (1, 2, or 3)
- Signature, claim amount, proof
- Loading and error states

**Wallet State (hooks from libraries):**
- `useEthAccount()` - Ethereum connection status
- `useStarknetAccount()` - Starknet connection status
- `useSignMessage()` - Message signing functionality

**Side Effects (useEffect):**
- Eligibility checking when ETH address changes
- Step advancement when conditions are met
- Debounced API calls to prevent rapid requests

## Error Handling

The application handles errors at multiple levels:

1. **Wallet Connection Errors:** Caught by provider error boundaries
2. **Signature Errors:** Displayed to user with retry option
3. **Transaction Errors:** Extracted from Starknet error objects
4. **Network Errors:** Graceful fallback with user-friendly messages

**Code:** Error handling is implemented throughout `page.tsx` with try-catch blocks and error state management.

## Debug Panel

The debug panel provides real-time visibility into:
- Connection states (ETH and Starknet)
- Addresses and signatures
- Migration step progression
- Contract addresses
- Transaction hashes
- Detailed log messages

**Why include this?** For developers learning the system, the debug panel shows exactly what's happening at each step. It's also useful for troubleshooting connection or transaction issues.

## Security Considerations

**What this demo does:**
- Verifies merkle proofs on-chain
- Uses session keys for gasless transactions
- Requires signature from Ethereum wallet

**What this demo doesn't do (production requirements):**
- Verify Ethereum signatures on-chain (requires backend)
- Rate limiting on merkle tree fetches
- Multi-user merkle tree (current tree has one address)

**For production:** Add a backend service that verifies Ethereum signatures before allowing claims.

## Key Takeaways

1. **Dual-wallet architecture** enables cross-chain migration
2. **Cartridge Controller** provides gasless, invisible transactions
3. **Merkle trees** enable efficient eligibility verification
4. **Session keys** eliminate user friction after initial setup
5. **Passkey authentication** improves security and UX

This architecture demonstrates how to build a production-ready migration portal that balances security, user experience, and cost efficiency.

