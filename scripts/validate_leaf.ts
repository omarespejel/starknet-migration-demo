#!/usr/bin/env ts-node

/**
 * Validation script to verify TypeScript and Cairo compute the same leaf hash
 * 
 * Usage: 
 *   cd scripts
 *   npm install
 *   npx ts-node validate_leaf.ts
 */

import { poseidonHashMany } from '@starkware-industries/starkware-utils';

/**
 * Compute leaf hash matching Cairo's compute_leaf function
 */
function computeLeaf(address: string, amount: bigint): bigint {
  const addressBigInt = BigInt(address);
  const MASK_128 = (BigInt(1) << BigInt(128)) - BigInt(1);
  const amountLow = amount & MASK_128;
  const amountHigh = amount >> BigInt(128);
  
  return poseidonHashMany([addressBigInt, amountLow, amountHigh]);
}

function main() {
  console.log('🔍 Validating TypeScript ↔ Cairo Leaf Computation\n');
  
  // Test case 1: USER1() from Cairo tests (0x10)
  const TEST_USER1 = '0x10';
  const TEST_AMOUNT1 = BigInt(1000);
  const leaf1 = computeLeaf(TEST_USER1, TEST_AMOUNT1);
  
  console.log('Test Case 1:');
  console.log(`  Address: ${TEST_USER1}`);
  console.log(`  Amount: ${TEST_AMOUNT1}`);
  console.log(`  Computed Leaf: 0x${leaf1.toString(16)}`);
  console.log(`  Expected: Compare with Cairo test output\n`);
  
  // Test case 2: USER2() from Cairo tests (0x20)
  const TEST_USER2 = '0x20';
  const TEST_AMOUNT2 = BigInt(2000);
  const leaf2 = computeLeaf(TEST_USER2, TEST_AMOUNT2);
  
  console.log('Test Case 2:');
  console.log(`  Address: ${TEST_USER2}`);
  console.log(`  Amount: ${TEST_AMOUNT2}`);
  console.log(`  Computed Leaf: 0x${leaf2.toString(16)}\n`);
  
  // Test case 3: Large amount (high bits)
  const TEST_USER3 = '0x1234567890123456789012345678901234567890123456789012345678901234';
  const TEST_AMOUNT3 = BigInt('340282366920938463463374607431768211456'); // 2^128
  const leaf3 = computeLeaf(TEST_USER3, TEST_AMOUNT3);
  
  console.log('Test Case 3 (Large amount with high bits):');
  console.log(`  Address: ${TEST_USER3.slice(0, 20)}...`);
  console.log(`  Amount: 2^128 (high=1, low=0)`);
  console.log(`  Computed Leaf: 0x${leaf3.toString(16)}\n`);
  
  console.log('✅ Validation complete');
  console.log('📝 Compare these values with Cairo test output to verify match');
  console.log('   Run: cd contracts && snforge test test_claim_single_user_succeeds -v');
}

if (require.main === module) {
  main();
}

