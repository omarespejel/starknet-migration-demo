"use client";

// starknet provider setup with cartridge controller
// cartridge gives us gasless txns via session keys, passkey auth, and auto-execution

import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  jsonRpcProvider,
  cartridge,
} from "@starknet-react/core";
import ControllerConnector from "@cartridge/connector/controller";
import { SessionPolicies } from "@cartridge/controller";
import { constants } from "starknet";
import { useMemo, useState, useEffect } from "react";

const PORTAL_ADDRESS = process.env.NEXT_PUBLIC_PORTAL_ADDRESS ||
  "0x027d9db485a394d3aea0c3af6a82b889cb95a833cc4fe36ede8696624f0310fb";

// session policies - defines which methods can be called gaslessly
// user approves this once, then these methods run automatically without popups
const policies: SessionPolicies = {
  contracts: {
    [PORTAL_ADDRESS]: {
      name: "Token Migration Portal",
      description: "Claim your migrated tokens",
      methods: [
        {
          name: "Claim Tokens",
          entrypoint: "claim",
          description: "Claim your migrated tokens (gasless)",
        },
        {
          name: "Check Claimable",
          entrypoint: "get_claimable",
          description: "Check if address can claim",
        },
      ],
    },
  },
};

// rpc provider - using cartridge's endpoints
const provider = jsonRpcProvider({
  rpc: (chain) => {
    const url = chain.id === sepolia.id
      ? "https://api.cartridge.gg/x/starknet/sepolia"
      : "https://api.cartridge.gg/x/starknet/mainnet";
    return { nodeUrl: url };
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);

  // create the cartridge connector - only on client side since it needs browser APIs
  const connector = useMemo(() => {
    // skip during SSR
    if (typeof window === "undefined") {
      return null;
    }
    
    try {
      const ctrl = new ControllerConnector({
        // networks we support
        chains: [
          { rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia" },
          { rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet" },
        ],
        defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
        
        // session policies for gasless txns
        policies,
        
        // keychain url
        url: "https://x.cartridge.gg",
        
        // auth options
        signupOptions: ["webauthn", "google", "twitter", "github"],
        
        // ui stuff
        theme: "dope-wars",
        colorMode: "dark",
        
        // redirect after auth
        redirectUrl: process.env.NEXT_PUBLIC_CARTRIDGE_REDIRECT_URL || 
                     (typeof window !== "undefined" ? window.location.origin : undefined),
        
        // show errors if session fails
        propagateSessionErrors: true,
      } as any);
      
      return ctrl;
    } catch (error) {
      console.error("[INIT] ControllerConnector failed:", error);
      setInitError(error as Error);
      return null;
    }
  }, []);

  // mark as mounted after hydration
  useEffect(() => {
    console.log("[MOUNT] Client mounted, connector:", connector?.id || "null");
    setMounted(true);
    
    // test if cartridge rpc is reachable (just for debugging)
    fetch("https://api.cartridge.gg/x/starknet/sepolia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "starknet_chainId", params: [], id: 1 }),
    })
      .then(r => r.json())
      .then(data => console.log("[MOUNT] Cartridge RPC reachable, chain:", data.result))
      .catch(e => console.error("[MOUNT] Cartridge RPC error:", e.message));
      
    // test keychain
    fetch("https://x.cartridge.gg/health")
      .then(r => console.log("[MOUNT] Cartridge keychain reachable:", r.status))
      .catch(e => console.error("[MOUNT] Cartridge keychain error:", e.message));
  }, [connector]);

  // show loading until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Initializing wallet...</p>
        </div>
      </div>
    );
  }

  // show error if connector failed
  if (initError || !connector) {
    return (
      <div className="min-h-screen bg-red-900 text-white p-8">
        <h1 className="text-2xl font-bold mb-4">Controller Init Error</h1>
        <pre className="font-mono text-sm bg-black/50 p-4 rounded overflow-auto">
          {initError?.message || "Connector not initialized"}
        </pre>
        <p className="mt-4 text-gray-300">Check browser console (F12) for details.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  console.log("[RENDER] Providers with connector:", connector.id);

  return (
    <StarknetConfig
      autoConnect
      chains={[sepolia, mainnet]}
      provider={provider}
      connectors={[connector]}
      explorer={cartridge}
    >
      {children}
    </StarknetConfig>
  );
}
