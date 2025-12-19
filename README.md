# Token Migration Portal

[![Tests](https://img.shields.io/badge/tests-37%20passing-brightgreen)](./contracts/tests)
[![Cairo](https://img.shields.io/badge/Cairo-2.11.4-blue)](https://www.cairo-lang.org/)
[![Starknet Foundry](https://img.shields.io/badge/snforge-0.50.0-orange)](https://foundry-rs.github.io/starknet-foundry/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A Token Migration Portal demonstrating how to migrate tokens from any chain (EVM, IMX, Solana, etc.) to Starknet using Merkle proof verification. Includes test coverage (37 tests) and a frontend interface.

## Features

- **Merkle proof verification** — users prove eligibility from a snapshot
- **Atomic claim flow** — verify proof → mark claimed → mint/transfer in one transaction
- **Cartridge Controller** — passkey auth with session keys for gasless UX
- **Modern Cairo patterns** — OpenZeppelin components, CEI, reentrancy guards

## Project Structure

```
starknet-migration-demo/
├── contracts/          # Cairo smart contracts
│   ├── src/
│   │   ├── lib.cairo
│   │   ├── token.cairo      # ERC20 token with minter role
│   │   ├── portal.cairo     # Migration portal contract
│   │   └── test_utils.cairo # Shared test utilities
│   ├── tests/
│   │   ├── test_token.cairo              # Token contract tests (12 tests)
│   │   ├── test_portal.cairo             # Basic portal tests
│   │   ├── test_portal_comprehensive.cairo # Comprehensive portal tests (22 tests)
│   │   ├── test_fuzz.cairo               # Property-based fuzz tests (3 tests)
│   │   └── merkle_helper.cairo           # Merkle tree test helpers
│   └── Scarb.toml
├── frontend/           # Next.js frontend
│   ├── app/
│   │   └── page.tsx    # Claim interface with Cartridge integration
│   └── package.json
├── scripts/
│   ├── generate_merkle.ts  # Merkle tree generation script
│   ├── validate_leaf.ts   # TypeScript ↔ Cairo validation
│   ├── deploy.sh          # Automated deployment script
│   ├── check_deployment.sh # Deployment verification script
│   └── package.json       # Script dependencies
├── docs/
│   └── context.xml         # Repomix context for auditors
├── snapshot.example.json   # Example snapshot template
├── DEPLOYMENT.md           # Detailed deployment guide
└── README.md
```

## Setup

### Prerequisites

- Scarb v2.11.4+ (Cairo v2.11.4+)
- Starknet Foundry (snforge) v0.49.0+
- Node.js 18+
- asdf (recommended for version management)

### Install Tooling

```bash
# Install asdf plugins
asdf plugin add scarb
asdf plugin add starknet-foundry

# Install latest versions
asdf install scarb 2.11.4
asdf install starknet-foundry latest

# Set global versions
asdf set --home scarb 2.11.4
asdf set --home starknet-foundry latest

# Verify installations
scarb --version    # Should show 2.11.4
snforge --version  # Should show 0.49.0+
```

### Build Contracts

```bash
cd contracts
scarb build
```

### Run Tests

```bash
cd contracts
snforge test
```

### Setup Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your portal contract address
npm run dev
```

## Usage

### 1. Generate Merkle Tree

**Step 1.1: Validate TypeScript ↔ Cairo Compatibility** (Optional but Recommended)

Verify that TypeScript and Cairo compute the same leaf hashes:

```bash
cd scripts
npm install  # Install dependencies if not already installed
npx ts-node validate_leaf.ts
```

Compare the output with Cairo test results. To get Cairo values, run:

```bash
cd contracts
snforge test test_claim_single_user_succeeds -v
```

The leaf hash should match between TypeScript and Cairo.

**Note:** If `npm install` fails for `@starkware-industries/starkware-utils`, you may need to install it from GitHub or use an alternative Poseidon implementation. The merkle tree generation will still work if you have the correct dependencies.

**Step 1.2: Create Snapshot File**

Create a snapshot file (`snapshot.json`) with claim data. You can use `snapshot.example.json` as a template:

```json
[
  {
    "address": "0x1234567890123456789012345678901234567890123456789012345678901234",
    "amount": "1000000000000000000"
  },
  {
    "address": "0x2345678901234567890123456789012345678901234567890123456789012345",
    "amount": "2000000000000000000"
  }
]
```

**Step 1.3: Generate Merkle Tree**

```bash
cd scripts
npx ts-node generate_merkle.ts ../snapshot.json
```

This generates `merkle_tree.json` with the root and proofs for each claim. Save the `root` value for deployment.

### 2. Deploy Contracts

**Option A: Automated Deployment Script**

```bash
# Set environment variables
export NETWORK=sepolia
export ADMIN=0x<YOUR_DEPLOYER_ADDRESS>
export MERKLE_ROOT=0x<FROM_MERKLETREE_JSON>
export DEADLINE_BLOCK=10000000  # Optional: ~3 months from now
export MAX_CLAIM_LOW=1000000000000000000000  # Optional: 1000 tokens (18 decimals)
export MAX_CLAIM_HIGH=0  # Optional: high part of max amount

# Run deployment script
cd scripts
chmod +x deploy.sh
./deploy.sh
```

The script will output the deployed contract addresses. Save these for frontend configuration.

**Option B: Manual Deployment**

```bash
# Declare contracts
sncast declare --contract-name MigrationToken --network sepolia
sncast declare --contract-name MigrationPortal --network sepolia

# Deploy token
sncast deploy --class-hash <TOKEN_CLASS_HASH> \
  --constructor-calldata str:MigToken str:MIG <admin> 0x0 \
  --network sepolia

# Deploy portal (with max_claim_amount as u256: low, high)
sncast deploy --class-hash <PORTAL_CLASS_HASH> \
  --constructor-calldata <owner> <token_address> <merkle_root> <deadline_block> <max_low> <max_high> \
  --network sepolia

# Grant minter role to portal
sncast invoke --contract-address <TOKEN_ADDRESS> \
  --function grant_minter_role \
  --calldata <PORTAL_ADDRESS> \
  --network sepolia
```

### 3. Configure Frontend

Update `frontend/.env.local` with your deployed portal address:

```
NEXT_PUBLIC_PORTAL_ADDRESS=0x...
```

### 4. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and connect your wallet to test the claim flow.

## Deployment

**Quick Start:** See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for step-by-step instructions.

**Detailed Guide:** See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive documentation.

### Quick Deployment

```bash
# 1. Generate merkle tree
cd scripts && npm install
npx ts-node generate_merkle.ts ../snapshot.json

# 2. Deploy contracts
export ADMIN=0x<YOUR_ADDRESS>
export MERKLE_ROOT=0x<FROM_MERKLETREE_JSON>
export NETWORK=sepolia
./deploy.sh

# 3. Verify deployment
./check_deployment.sh

# 4. Configure frontend
cd ../frontend
echo "NEXT_PUBLIC_PORTAL_ADDRESS=0x<PORTAL_ADDRESS>" > .env.local
npm install && npm run dev
```

## Security Features

- **CEI Pattern**: Checks-Effects-Interactions pattern enforced
- **Reentrancy Protection**: Pausable component prevents reentrancy
- **Access Control**: Role-based access control for minting
- **Timelock**: Merkle root updates require 48-hour timelock
- **Deadline**: Claim period has a hard deadline

## Test Coverage

The project includes 37 tests covering core functionality and common error cases. Test breakdown:

### Test Statistics

- **Total Tests**: 37
- **Status**: All passing
- **Test Files**: 4 files
  - `test_token.cairo`: 12 tests
  - `test_portal_comprehensive.cairo`: 22 tests  
  - `test_fuzz.cairo`: 3 fuzz tests
  - `test_portal.cairo`: Basic integration tests

### Test Breakdown

#### Token Contract Tests (12 tests)

**Deployment** (5 tests)
- `test_deploy_initializes_name_and_symbol`
- `test_deploy_grants_admin_role`
- `test_deploy_grants_minter_role_when_not_zero`
- `test_deploy_with_zero_minter_does_not_grant_role`
- Initial supply validation

**Minting** (4 tests)
- `test_mint_by_minter_succeeds`
- `test_mint_by_non_minter_fails`
- `test_mint_zero_amount_fails`
- `test_mint_exceeds_max_supply_fails`

**Access Control** (3 tests)
- `test_admin_can_grant_minter_role`
- `test_admin_can_revoke_minter_role`
- Role validation checks

#### Portal Contract Tests (22 tests)

**Claim Functionality** (8 tests)
- `test_claim_single_user_succeeds` - Single-leaf merkle tree
- `test_claim_two_users_both_succeed` - Two-leaf merkle tree
- `test_claim_four_users_with_multilevel_tree` - Multi-level tree
- `test_claim_large_u256_amount_with_high_bits` - Large amounts
- Token balance verification after claim
- Total claimed tracking
- `test_get_claimable_returns_true_for_valid_claim`
- `test_get_claimable_returns_false_after_claim`

**Error Cases** (8 tests)
- `test_double_claim_fails` - Prevents double spending
- `test_claim_after_deadline_fails` - Deadline enforcement
- `test_claim_wrong_amount_fails` - Invalid proof rejection
- `test_claim_wrong_user_with_anothers_proof_fails` - User validation
- `test_claim_zero_amount_fails` - Zero amount check
- `test_claim_exceeds_max_amount_fails` - Max amount enforcement
- Proof length validation
- Wrong amount with valid proof rejection

**Admin Functions** (3 tests)
- `test_propose_merkle_root_creates_pending` - Root proposal
- `test_execute_root_update_before_timelock_fails` - Timelock enforcement
- `test_timelock_execution_after_waiting` - Timelock execution

**Pausable** (2 tests)
- `test_claim_when_paused_fails` - Pause functionality
- `test_claim_after_unpause_succeeds` - Unpause functionality

#### Fuzz Tests (3 tests)
- `fuzz_any_valid_amount_claims_successfully` - 100 runs, tests various amounts
- `fuzz_compute_leaf_deterministic` - 50 runs, verifies leaf computation consistency
- `fuzz_boundary_amounts` - 25 runs, tests boundary value handling

### Security Test Coverage

| Security Feature | Tests |
|-----------------|-------|
| Reentrancy Protection | Pausable tests (2 tests) |
| Access Control | Role-based tests (12 tests) |
| Input Validation | Zero amount, max amount, deadline (5 tests) |
| Merkle Proof Verification | Valid/invalid proof (4 tests) |
| Timelock Protection | Timelock tests (2 tests) |
| Double-Spend Prevention | Double claim test (1 test) |
| Large u256 Handling | Large amount tests (1 test) |

### Running Tests

```bash
cd contracts

# Run all tests
snforge test

# Run specific test suite
snforge test test_token
snforge test test_portal_comprehensive
snforge test test_fuzz

# Run with coverage (requires coverage profile)
snforge test --coverage

# Run fuzz tests with more iterations
snforge test --fuzzer-runs 500
```

### Test Coverage Notes

- Core functions tested: claim, mint, admin functions, view functions
- Error paths: All error conditions have corresponding tests
- Integration: Tests cover full claim flow including token minting
- Edge cases: Zero amounts, max values, boundary conditions
- Fuzz testing: Property-based tests for amount handling and determinism

**Limitations:**
- No formal verification
- No gas optimization benchmarks
- Limited multi-contract integration scenarios

## License

MIT

