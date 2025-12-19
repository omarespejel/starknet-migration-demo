// contract addresses and network config
// TODO: should probably use env vars in prod but this works for now

// portal contract address - handles the migration logic
export const PORTAL_ADDRESS =
  process.env.NEXT_PUBLIC_PORTAL_ADDRESS ||
  "0x027d9db485a394d3aea0c3af6a82b889cb95a833cc4fe36ede8696624f0310fb";

// token contract - the ERC20 that gets minted
// portal needs MINTER_ROLE to mint tokens
export const TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_TOKEN_ADDRESS ||
  "0x07ef08eb2287fe9a996bb3de1e284b595fab5baae51374e0d8fc088c2d4334c9";

// which network to use - sepolia or mainnet
export const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "sepolia";

// generate a starkscan url for a tx hash
// basically like etherscan but for starknet
export function getStarkscanUrl(txHash: string, network?: string): string {
  const net = network || NETWORK;
  const baseUrl = net === "mainnet" 
    ? "https://starkscan.co/tx" 
    : "https://sepolia.starkscan.co/tx";
  return `${baseUrl}/${txHash}`;
}

