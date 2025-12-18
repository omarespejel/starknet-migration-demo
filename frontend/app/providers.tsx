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
      methods: [
        {
          name: "Claim Tokens",
          entrypoint: "claim",
          description: "Claim your migrated tokens",
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
      console.log("🔧 [INIT] Creating ControllerConnector...");
      const ctrl = new ControllerConnector({
        chains: [
          { rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia" },
          { rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet" },
        ],
        defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
        policies,
      });
      console.log("✅ [INIT] ControllerConnector created:", ctrl.id);
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
  }, [connector]);

  // Show loading until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading wallet connector...</p>
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
