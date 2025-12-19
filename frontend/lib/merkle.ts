/**
 * Merkle tree utilities for fetching allocation and proof data
 */

export interface ClaimData {
  address: string;
  amount: string;
  proof: string[];
}

/**
 * Fetch allocation data from merkle tree
 * In production, this would call your backend API
 */
export async function fetchAllocation(
  ethAddress: string,
  starknetAddress: string
): Promise<ClaimData | null> {
  try {
    // In production, replace this with an API call to your backend
    // Example: const response = await fetch(`/api/merkle/${ethAddress}`);
    
    // For now, load from the generated merkle tree JSON
    // This should be replaced with a backend API that:
    // 1. Verifies the ETH signature
    // 2. Looks up the allocation in the merkle tree
    // 3. Returns the proof for the Starknet address
    
    const response = await fetch("/api/merkle-tree.json");
    if (!response.ok) {
      return null;
    }
    
    const merkleData = await response.json();
    
    // Find the claim for the Starknet address
    const claim = merkleData.claims?.find(
      (c: ClaimData) =>
        c.address.toLowerCase().replace(/^0x/, "").padStart(64, "0") ===
        starknetAddress.toLowerCase().replace(/^0x/, "").padStart(64, "0")
    );
    
    return claim || null;
  } catch (error) {
    console.error("Error fetching allocation:", error);
    return null;
  }
}

/**
 * Normalize address for comparison
 */
export function normalizeAddress(address: string): string {
  if (!address) return "";
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

