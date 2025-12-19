# Testing Documentation

## Test Setup

This project uses **Jest** and **React Testing Library** for testing, following Test-Driven Development (TDD) principles.

## Test Structure

```
frontend/
├── __tests__/
│   └── helpers.tsx          # Test utilities and mocks
├── app/
│   ├── __tests__/
│   │   └── eth-providers.test.tsx
│   └── migrate/
│       └── __tests__/
│           └── page.test.tsx
├── lib/
│   └── __tests__/
│       ├── constants.test.ts
│       └── merkle.test.ts
├── jest.config.js           # Jest configuration
└── jest.setup.js            # Test setup and mocks
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

### ✅ Passing Tests (27 tests)

#### Utility Tests (`lib/__tests__/`)
- **constants.test.ts** - Contract address validation
  - ✅ PORTAL_ADDRESS format validation
  - ✅ TOKEN_ADDRESS format validation
  - ✅ NETWORK value validation

- **merkle.test.ts** - Merkle tree utilities
  - ✅ Address normalization (lowercase, padding)
  - ✅ Address matching (case-insensitive)
  - ✅ Fetch allocation from merkle tree
  - ✅ Error handling for network failures
  - ✅ Edge cases (empty addresses, missing data)

#### Component Tests (`app/__tests__/`)
- **eth-providers.test.tsx** - Ethereum provider setup
  - ✅ Provider rendering
  - ✅ Provider nesting (WagmiProvider → QueryClientProvider → RainbowKitProvider)
  - ✅ QueryClient initialization

### 🔧 Integration Tests (`app/migrate/__tests__/`)
- **page.test.tsx** - Migration flow component
  - ✅ Step 1: MetaMask connection and signing
  - ✅ Step 2: Cartridge Controller connection
  - ✅ Step 3: Token claiming
  - ⚠️ Some integration tests need mock adjustments (9 tests)

## Test Files Included in Repomix

All test files are included in `repomix.config.json`:
- `frontend/jest.config.js`
- `frontend/jest.setup.js`
- `frontend/app/__tests__/**`
- `frontend/lib/__tests__/**`
- `frontend/__tests__/**`

## Mocking Strategy

### External Dependencies
- **wagmi** - Mocked hooks (`useAccount`, `useSignMessage`)
- **@starknet-react/core** - Mocked hooks (`useAccount`, `useConnect`)
- **@rainbow-me/rainbowkit** - Mocked `ConnectButton` component
- **starknet** - Mocked `CallData` utilities
- **next/navigation** - Mocked router hooks

### Test Helpers

Located in `__tests__/helpers.tsx`:
- `MOCK_ADDRESSES` - Test wallet addresses
- `MOCK_MERKLE_DATA` - Sample merkle tree data
- `TestWrapper` - Component wrapper for tests

## Writing New Tests

### Example: Testing a Utility Function

```typescript
import { normalizeAddress } from '../merkle';

describe('normalizeAddress', () => {
  it('should normalize address correctly', () => {
    const address = '0x123';
    const normalized = normalizeAddress(address);
    expect(normalized.length).toBe(64);
  });
});
```

### Example: Testing a Component

```typescript
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Test Configuration

### Jest Config (`jest.config.js`)
- Uses `next/jest` for Next.js integration
- Test environment: `jsdom`
- Path aliases: `@/*` → `./*`
- Coverage collection from `app/**` and `lib/**`

### Setup (`jest.setup.js`)
- Imports `@testing-library/jest-dom` matchers
- Mocks Next.js router
- Mocks `window.matchMedia`
- Sets up environment variables

## Continuous Integration

Tests should run in CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run tests
  run: |
    cd frontend
    npm test -- --coverage --watchAll=false
```

## Coverage Goals

- **Target**: 80%+ coverage
- **Current**: ~75% (utility functions fully covered)
- **Focus Areas**: Component integration tests

## Known Issues

1. **Integration Tests**: Some migration page tests need mock adjustments
2. **Helpers File**: `__tests__/helpers.tsx` excluded from test matching (not a test file)

## Best Practices

1. ✅ Write tests before implementation (TDD)
2. ✅ Test behavior, not implementation
3. ✅ Use descriptive test names
4. ✅ Mock external dependencies
5. ✅ Test edge cases and error scenarios
6. ✅ Keep tests isolated and independent

