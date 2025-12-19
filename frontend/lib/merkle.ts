/**
 * Merkle tree utilities for token migration claims
 */

export interface ClaimData {
  address: string;      // ETH/IMX address (from L1 snapshot)
  amount: string;
  proof: string[];
}

export interface MerkleTree {
  root: string;
  claims: ClaimData[];
}

/**
 * Normalize ETH address (lowercase, no padding needed - always 40 chars)
 */
export function normalizeEthAddress(address: string): string {
  if (!address) return '';
  return address.toLowerCase().replace('0x', '');
}

/**
 * Fetch allocation data for an ETH address from the merkle tree
 * Returns the amount and proof if found, null if not eligible
 */
export async function fetchAllocation(
  ethAddress: string,
  _starknetAddress: string  // Kept for API compatibility, but not used for lookup
): Promise<{ amount: string; proof: string[] } | null> {
  try {
    const response = await fetch('/merkle-tree.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch merkle tree: ${response.status}`);
    }
    
    const data: MerkleTree = await response.json();
    
    // Lookup by ETH address (the L1/IMX snapshot)
    const normalizedEth = normalizeEthAddress(ethAddress);
    const claim = data.claims.find((c: ClaimData) => 
      normalizeEthAddress(c.address) === normalizedEth
    );
    
    if (!claim) {
      return null;
    }
    
    return {
      amount: claim.amount,
      proof: claim.proof
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[MERKLE] Error fetching allocation:', error);
    }
    throw error;
  }
}

