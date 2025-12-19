"use client";

/**
 * Starknet Provider Configuration with Cartridge Controller
 * 
 * This component sets up the Starknet React provider with Cartridge Controller integration.
 * Cartridge Controller is a smart wallet solution that provides three key advantages:
 * 
 * 1. Gasless Transactions: Uses session keys to pre-authorize transactions, eliminating
 *    gas fees for users. The session keys are stored securely in Cartridge's keychain.
 * 
 * 2. Passkey Authentication: Instead of seed phrases, users authenticate with WebAuthn
 *    passkeys (biometrics or hardware security keys). This improves security and UX.
 * 
 * 3. Invisible Execution: After initial session approval, transactions matching the
 *    policy execute automatically without user interaction or popups.
 * 
 * How Session Keys Work:
 * - User connects and approves a session policy (one-time)
 * - Cartridge generates temporary signing keys for approved contract methods
 * - These keys are stored in Cartridge's secure keychain
 * - Future transactions matching the policy use these keys automatically
 * - No user approval needed, no gas fees charged
 */

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

/**
 * Session Policies: Define which contract methods can be called gaslessly
 * 
 * When a user connects Cartridge Controller, they approve this policy. The policy
 * grants permission for the portal contract's `claim` and `get_claimable` methods
 * to be executed using session keys without user interaction.
 * 
 * This is a security feature: users explicitly approve which methods can be called
 * automatically. Other methods still require explicit user approval.
 */
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

/**
 * RPC Provider Configuration
 * 
 * We use Cartridge's public RPC endpoints for Starknet. These endpoints provide
 * reliable access to the Starknet network and are optimized for Cartridge Controller
 * integrations.
 */
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

  /**
   * Controller Connector Initialization
   * 
   * We create the Cartridge Controller connector only on the client side (not during
   * server-side rendering) because it requires browser APIs like window and indexedDB.
   * 
   * Key Configuration Options:
   * - chains: Supported Starknet networks (Sepolia testnet and mainnet)
   * - policies: Session policies defining gasless transaction permissions
   * - url: Cartridge keychain URL where session keys are stored
   * - redirectUrl: Where to redirect after authentication (production domain)
   * - signupOptions: Authentication methods (WebAuthn passkeys, social logins)
   * 
   * The connector creates an iframe that communicates with Cartridge's keychain service.
   * This iframe handles authentication, session key management, and transaction signing.
   */
  const connector = useMemo(() => {
    // Skip connector creation during server-side rendering
    if (typeof window === "undefined") {
      return null;
    }
    
    try {
      const ctrl = new ControllerConnector({
        // Network configuration: support both testnet and mainnet
        chains: [
          { rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia" },
          { rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet" },
        ],
        defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
        
        // Session policies: define which methods can be called gaslessly
        policies,
        
        // Keychain URL: where Cartridge stores session keys and handles authentication
        url: "https://x.cartridge.gg",
        
        // Authentication options: WebAuthn passkeys and social logins
        signupOptions: ["webauthn", "google", "twitter", "github"],
        
        // UI customization
        theme: "dope-wars",
        colorMode: "dark",
        
        // Production redirect URL: where to redirect after authentication
        redirectUrl: process.env.NEXT_PUBLIC_CARTRIDGE_REDIRECT_URL || 
                     (typeof window !== "undefined" ? window.location.origin : undefined),
        
        // Error propagation: surface session errors to the application
        propagateSessionErrors: true,
      } as any);
      
      return ctrl;
    } catch (error) {
      console.error("[INIT] ControllerConnector failed:", error);
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
