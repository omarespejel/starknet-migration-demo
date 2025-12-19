/**
 * Merkle Tree Utilities for Token Migration Claims
 * 
 * A merkle tree is a cryptographic data structure that enables efficient proof
 * verification. Instead of storing all eligible addresses on-chain (expensive),
 * we store only the root hash. Users provide proofs that their address is in
 * the tree, and the contract verifies these proofs against the root.
 * 
 * How Merkle Trees Work:
 * 1. Snapshot: Take a snapshot of all eligible L1 addresses and their token amounts
 * 2. Tree Generation: Build a binary tree where each leaf is a hash of (address, amount)
 * 3. Root Storage: Store only the root hash in the portal contract
 * 4. Proof Generation: For each address, generate a proof path from leaf to root
 * 5. Verification: Contract verifies proof by recomputing hashes up to the root
 * 
 * Advantages:
 * - Gas Efficient: Only one hash (root) stored on-chain, not all addresses
 * - Scalable: Works for millions of addresses without increasing contract storage
 * - Verifiable: Cryptographic proofs ensure data integrity
 */

export interface ClaimData {
  address: string;      // ETH/IMX address from L1 snapshot
  amount: string;       // Token amount in wei (18 decimals)
  proof: string[];      // Merkle proof path (array of sibling hashes)
}

export interface MerkleTree {
  root: string;         // Root hash stored in portal contract
  claims: ClaimData[];  // All eligible addresses with their proofs
}

/**
 * Normalize Ethereum Address
 * 
 * Ethereum addresses are case-insensitive but often stored with mixed case.
 * This function normalizes addresses for comparison by converting to lowercase
 * and removing the 0x prefix.
 * 
 * Why normalize? Different wallets may return addresses in different cases,
 * but they represent the same address. Normalization ensures consistent matching.
 */
export function normalizeEthAddress(address: string): string {
  if (!address) return '';
  return address.toLowerCase().replace('0x', '');
}

/**
 * Fetch Allocation Data from Merkle Tree
 * 
 * This function looks up an Ethereum address in the merkle tree and returns
 * the allocation amount and proof if found. The lookup is done client-side
 * by fetching merkle-tree.json from the public folder.
 * 
 * In production, this would typically call a backend API that:
 * 1. Verifies the Ethereum signature
 * 2. Looks up the allocation in a database
 * 3. Generates or retrieves the merkle proof
 * 4. Returns the data securely
 * 
 * Why client-side lookup for demo? Simplifies the demo and allows developers
 * to see how merkle proofs work without backend infrastructure.
 * 
 * @param ethAddress - Ethereum address to look up (from L1 snapshot)
 * @param _starknetAddress - Starknet address (kept for API compatibility, not used)
 * @returns Allocation data with amount and proof, or null if not eligible
 */
export async function fetchAllocation(
  ethAddress: string,
  _starknetAddress: string  // Kept for API compatibility, but not used for lookup
): Promise<{ amount: string; proof: string[] } | null> {
  try {
    // Fetch merkle tree data from public folder
    // In production, this would be a backend API call
    const response = await fetch('/merkle-tree.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch merkle tree: ${response.status}`);
    }
    
    const data: MerkleTree = await response.json();
    
    // Lookup by ETH address (the L1 snapshot)
    // The merkle tree is keyed by Ethereum addresses, not Starknet addresses
    const normalizedEth = normalizeEthAddress(ethAddress);
    const claim = data.claims.find((c: ClaimData) => 
      normalizeEthAddress(c.address) === normalizedEth
    );
    
    if (!claim) {
      // Address not found in merkle tree - user is not eligible
      return null;
    }
    
    // Return the allocation data needed for the claim transaction
    return {
      amount: claim.amount,  // Token amount in wei format
      proof: claim.proof     // Merkle proof array for on-chain verification
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[MERKLE] Error fetching allocation:', error);
    }
    throw error;
  }
}

