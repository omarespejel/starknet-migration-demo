/**
 * Test helpers and utilities
 */

import React from 'react';

/**
 * Mock wallet addresses for testing
 */
export const MOCK_ADDRESSES = {
  ETH: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',  // ETH address for lookup
  STARKNET: '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152',
  STARKNET_ALT: '0x53371c2a24c3a9b7fcd60c70405e24e72d17a835e43c53bb465eee6e271044b',
};

/**
 * Mock merkle tree data
 */
export const MOCK_MERKLE_DATA = {
  root: '0x63cf9212cb1ef5748af2fd0d4f1517446068f6e0cc45fb489556e6b6acdc497',
  claims: [
    {
      address: MOCK_ADDRESSES.ETH,  // Now uses ETH address
      amount: '1000000000000000000',
      proof: [],
    },
  ],
};

/**
 * Create a test wrapper with all providers
 */
export function TestWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

