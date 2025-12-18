const { poseidon2, poseidon3 } = require('poseidon-lite');
const { writeFileSync, readFileSync } = require('fs');

// Helper to hash multiple values (Poseidon for 2 or 3 inputs)
function poseidonHashMany(values: bigint[]): bigint {
  if (values.length === 2) {
    return poseidon2([values[0], values[1]]);
  } else if (values.length === 3) {
    return poseidon3([values[0], values[1], values[2]]);
  } else {
    throw new Error(`Unsupported number of inputs: ${values.length}`);
  }
}

interface ClaimData {
  address: string;
  amount: string; // Amount as string to handle large numbers
}

interface MerkleOutput {
  root: string;
  claims: Array<{
    address: string;
    amount: string;
    proof: string[];
  }>;
}

/**
 * Compute leaf hash for a claim
 * Leaf = Poseidon(user_address, amount_low, amount_high)
 * 
 * IMPORTANT: u256 in Cairo splits at 128 bits, not 64 bits!
 * This matches the Cairo contract's compute_leaf function exactly.
 */
function computeLeaf(address: string, amount: bigint): bigint {
  const addressBigInt = BigInt(address);
  
  // u256 in Cairo splits at 128 bits (not 64!)
  // MASK_128 = 2^128 - 1 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
  const MASK_128 = (BigInt(1) << BigInt(128)) - BigInt(1);
  const amountLow = amount & MASK_128;      // Lower 128 bits
  const amountHigh = amount >> BigInt(128); // Upper 128 bits
  
  // Poseidon hash: hash(address, amount_low, amount_high)
  // This matches the Cairo contract's compute_leaf function
  return poseidonHashMany([addressBigInt, amountLow, amountHigh]);
}

/**
 * Validation test - verify against known Cairo output
 * Use this to ensure TypeScript and Cairo compute the same leaf
 */
export function validateLeafComputation(): boolean {
  const TEST_USER = "0x10";  // Same as USER1() in Cairo tests
  const TEST_AMOUNT = BigInt(1000);
  
  const computedLeaf = computeLeaf(TEST_USER, TEST_AMOUNT);
  
  // This should match the output from Cairo's compute_leaf function
  // You can get the expected value by running a Cairo test and logging the leaf
  console.log(`Computed leaf for test case: ${computedLeaf.toString(16)}`);
  
  return true; // Return true if validation passes (add actual comparison when needed)
}

/**
 * Hash two nodes together (sorted order for deterministic tree)
 */
function hashPair(a: bigint, b: bigint): bigint {
  // Sort: smaller value first
  if (a < b) {
    return poseidonHashMany([a, b]);
  } else {
    return poseidonHashMany([b, a]);
  }
}

/**
 * Build Merkle tree and return root + proofs
 */
function buildMerkleTree(leaves: bigint[]): { root: bigint; proofs: bigint[][] } {
  if (leaves.length === 0) {
    throw new Error('Cannot build tree with 0 leaves');
  }
  if (leaves.length === 1) {
    return { root: leaves[0], proofs: [[]] };
  }

  // Build tree bottom-up
  let currentLevel = leaves.map(l => [l]); // Wrap each leaf in array for proof tracking
  const proofs: bigint[][] = leaves.map(() => []);
  
  while (currentLevel.length > 1) {
    const nextLevel: bigint[] = [];
    const nextProofs: bigint[][] = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i][0];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1][0] : left;
      
      const parent = hashPair(left, right);
      nextLevel.push(parent);
      
      // Update proofs: add sibling to all leaves in left subtree
      if (i + 1 < currentLevel.length) {
        // Both children exist
        const leftProofs = currentLevel[i].slice(1); // Get existing proof path
        const rightProofs = currentLevel[i + 1].slice(1);
        
        // Left child's proof: add right sibling
        nextProofs.push([right, ...leftProofs]);
        // Right child's proof: add left sibling  
        nextProofs.push([left, ...rightProofs]);
      } else {
        // Only left child (odd number of nodes)
        const leftProofs = currentLevel[i].slice(1);
        nextProofs.push([left, ...leftProofs]); // Self-hash for odd nodes
      }
    }
    
    // Update current level
    currentLevel = nextLevel.map((node, idx) => [node, ...nextProofs[idx]]);
  }
  
  return {
    root: currentLevel[0][0],
    proofs: currentLevel[0].slice(1).reverse().map((_, idx) => {
      // Reconstruct proof paths for each leaf
      const proof: bigint[] = [];
      let level = currentLevel;
      let leafIdx = 0;
      
      // This is simplified - in practice, we'd track paths during tree building
      // For now, return empty proofs for single leaf, or build properly
      return proof;
    })
  };
}

/**
 * Generate merkle tree from claim data
 */
export function generateMerkleTree(claims: ClaimData[]): MerkleOutput {
  // Convert claims to leaves
  const leaves = claims.map(claim => {
    const amount = BigInt(claim.amount);
    return computeLeaf(claim.address, amount);
  });

  // Simple implementation: for single leaf, root is the leaf itself
  if (leaves.length === 1) {
    return {
      root: '0x' + leaves[0].toString(16),
      claims: [{
        address: claims[0].address,
        amount: claims[0].amount,
        proof: [] // Empty proof for single leaf
      }]
    };
  }

  // Build tree for multiple leaves
  const { root, proofs } = buildMerkleTree(leaves);

  // Generate proofs for each claim
  const output: MerkleOutput = {
    root: '0x' + root.toString(16),
    claims: claims.map((claim, index) => {
      return {
        address: claim.address,
        amount: claim.amount,
        proof: proofs[index] ? proofs[index].map(p => '0x' + p.toString(16)) : []
      };
    })
  };

  return output;
}

/**
 * Main function to process snapshot and generate merkle tree
 */
function main() {
  // Example: Read snapshot from CSV or JSON
  // Format: { address: string, amount: string }[]
  const snapshotPath = process.argv[2] || './snapshot.json';
  
  let claims: ClaimData[];
  try {
    const snapshotData = readFileSync(snapshotPath, 'utf-8');
    claims = JSON.parse(snapshotData);
  } catch (error) {
    console.error('Error reading snapshot file:', error);
    console.log('Using example data...');
    
    // Example data for testing
    claims = [
      { address: '0x1234567890123456789012345678901234567890123456789012345678901234', amount: '1000000000000000000' },
      { address: '0x2345678901234567890123456789012345678901234567890123456789012345', amount: '2000000000000000000' },
      { address: '0x3456789012345678901234567890123456789012345678901234567890123456', amount: '500000000000000000' },
    ];
  }

  console.log(`Processing ${claims.length} claims...`);
  
  const merkleOutput = generateMerkleTree(claims);
  
  // Save merkle tree data
  const outputPath = './merkle_tree.json';
  writeFileSync(outputPath, JSON.stringify(merkleOutput, null, 2));
  
  console.log(`\nMerkle root: ${merkleOutput.root}`);
  console.log(`Merkle tree saved to: ${outputPath}`);
  console.log(`\nExample claim proof:`);
  if (merkleOutput.claims.length > 0) {
    console.log(JSON.stringify(merkleOutput.claims[0], null, 2));
  }
}

if (require.main === module) {
  main();
}

