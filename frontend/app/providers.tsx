"use client";

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

console.log("🔧 [INIT] PORTAL_ADDRESS:", PORTAL_ADDRESS);

const policies: SessionPolicies = {
  contracts: {
    [PORTAL_ADDRESS]: {
      name: "Token Migration Portal",
      description: "Claim your migrated GGMT tokens",
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

const provider = jsonRpcProvider({
  rpc: (chain) => {
    const url = chain.id === sepolia.id
      ? "https://api.cartridge.gg/x/starknet/sepolia"
      : "https://api.cartridge.gg/x/starknet/mainnet";
    console.log(`🔧 [RPC] Chain ${chain.id} → ${url}`);
    return { nodeUrl: url };
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);

  // Only create connector on client side
  const connector = useMemo(() => {
    if (typeof window === "undefined") {
      console.log("🔧 [INIT] Skipping connector creation on server");
      return null;
    }
    
    try {
      console.log("🔧 [INIT] Creating ControllerConnector with fixed config...");
      // Using 'as any' to allow advanced options that may not be in type definitions
      // but are supported at runtime by Cartridge Controller
      const ctrl = new ControllerConnector({
        // Network configuration
        chains: [
          { rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia" },
          { rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet" },
        ],
        defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
        
        // Session policies for gasless transactions
        policies,
        
        // ✨ FIXED: Remove lazyload to force immediate iframe mounting
        // lazyload: true, // ❌ REMOVED - causes initialization failures
        
        // ✨ FIXED: Explicitly set keychain URL
        url: "https://x.cartridge.gg",
        
        // ✨ Advanced options (may not be in TypeScript types but work at runtime)
        signupOptions: ["webauthn", "google", "twitter", "github"], // All available authentication methods
        theme: "dope-wars", // Options: "dope-wars", "cartridge", "degen", "slot"
        colorMode: "dark", // Options: "dark", "light"
        // Production redirect URL for Cartridge Controller
        redirectUrl: process.env.NEXT_PUBLIC_CARTRIDGE_REDIRECT_URL || 
                     (typeof window !== "undefined" ? window.location.origin : undefined),
        propagateSessionErrors: true,
      } as any);
      
      console.log("✅ [INIT] ControllerConnector created:", ctrl.id);
      console.log("🔑 [INIT] Keychain URL: https://x.cartridge.gg");
      console.log("🔑 [INIT] Session policies configured for gasless claims");
      return ctrl;
    } catch (error) {
      console.error("❌ [INIT] ControllerConnector failed:", error);
      setInitError(error as Error);
      return null;
    }
  }, []);

  // Mark as mounted after hydration
  useEffect(() => {
    console.log("🔧 [MOUNT] Client mounted, connector:", connector?.id || "null");
    setMounted(true);
    
    // Test Cartridge connectivity
    fetch("https://api.cartridge.gg/x/starknet/sepolia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "starknet_chainId", params: [], id: 1 }),
    })
      .then(r => r.json())
      .then(data => console.log("✅ Cartridge RPC reachable, chain:", data.result))
      .catch(e => console.error("❌ Cartridge RPC error:", e.message));
      
    // ✨ NEW: Test keychain accessibility
    fetch("https://x.cartridge.gg/health")
      .then(r => console.log("✅ Cartridge keychain reachable:", r.status))
      .catch(e => console.error("❌ Cartridge keychain error:", e.message));
  }, [connector]);

  // Show loading until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Initializing secure wallet...</p>
        </div>
      </div>
    );
  }

  // Show error if connector failed
  if (initError || !connector) {
    return (
      <div className="min-h-screen bg-red-900 text-white p-8">
        <h1 className="text-2xl font-bold mb-4">⚠️ Controller Init Error</h1>
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

  console.log("🔧 [RENDER] Providers with connector:", connector.id);

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
