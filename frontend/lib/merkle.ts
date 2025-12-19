// merkle tree stuff for checking eligibility
// basically we store just the root hash on-chain, then users prove their address is in the tree
// way cheaper than storing all addresses on-chain

export interface ClaimData {
  address: string;      // ETH/IMX address from L1 snapshot
  amount: string;       // Token amount in wei (18 decimals)
  proof: string[];      // Merkle proof path (array of sibling hashes)
}

export interface MerkleTree {
  root: string;         // Root hash stored in portal contract
  claims: ClaimData[];  // All eligible addresses with their proofs
}

// normalize eth address - lowercase and remove 0x
// wallets sometimes return addresses in different cases but they're the same address
export function normalizeEthAddress(address: string): string {
  if (!address) return '';
  return address.toLowerCase().replace('0x', '');
}

// fetch allocation from merkle tree
// looks up the eth address and returns amount + proof if found
// NOTE: in prod this would be a backend API call, but for demo we just fetch the json file
// TODO: add proper error handling for network failures
export async function fetchAllocation(
  ethAddress: string,
  _starknetAddress: string  // Kept for API compatibility, but not used for lookup
): Promise<{ amount: string; proof: string[] } | null> {
  try {
    // fetch the merkle tree json file
    // TODO: replace with backend API in production
    const response = await fetch('/merkle-tree.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch merkle tree: ${response.status}`);
    }
    
    const data: MerkleTree = await response.json();
    
    // lookup by eth address (not starknet address)
    const normalizedEth = normalizeEthAddress(ethAddress);
    const claim = data.claims.find((c: ClaimData) => 
      normalizeEthAddress(c.address) === normalizedEth
    );
    
    if (!claim) {
      // not in the tree, so not eligible
      return null;
    }
    
    // return the amount and proof for the claim tx
    return {
      amount: claim.amount,  // in wei
      proof: claim.proof     // merkle proof array
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[MERKLE] Error fetching allocation:', error);
    }
    throw error;
  }
}

