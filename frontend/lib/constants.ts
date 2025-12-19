/**
 * Contract Addresses and Network Configuration
 * 
 * These constants define the deployed contract addresses and network settings.
 * In production, these should be set via environment variables to support
 * different deployments (testnet vs mainnet).
 */

/**
 * Portal Contract Address
 * 
 * The migration portal contract handles:
 * - Merkle proof verification
 * - Double-claim prevention
 * - Token minting via minter role
 * - Timelock-protected merkle root updates
 */
export const PORTAL_ADDRESS =
  process.env.NEXT_PUBLIC_PORTAL_ADDRESS ||
  "0x027d9db485a394d3aea0c3af6a82b889cb95a833cc4fe36ede8696624f0310fb";

/**
 * Token Contract Address
 * 
 * The ERC20 token contract that receives minted tokens. The portal contract
 * must have the MINTER_ROLE to mint tokens on behalf of users.
 */
export const TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_TOKEN_ADDRESS ||
  "0x07ef08eb2287fe9a996bb3de1e284b595fab5baae51374e0d8fc088c2d4334c9";

/**
 * Network Configuration
 * 
 * Determines which Starknet network to use. Options: "sepolia" (testnet) or "mainnet"
 */
export const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "sepolia";

/**
 * Generate Starkscan Explorer URL
 * 
 * Starkscan is a block explorer for Starknet (similar to Etherscan for Ethereum).
 * This function generates the correct URL based on the network (testnet vs mainnet).
 * 
 * @param txHash - Transaction hash to view
 * @param network - Network name (defaults to NETWORK constant)
 * @returns Full URL to view transaction on Starkscan
 */
export function getStarkscanUrl(txHash: string, network?: string): string {
  const net = network || NETWORK;
  const baseUrl = net === "mainnet" 
    ? "https://starkscan.co/tx" 
    : "https://sepolia.starkscan.co/tx";
  return `${baseUrl}/${txHash}`;
}

