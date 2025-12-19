"use client";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, useEffect } from "react";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID;

// Debug logging
console.log("[ETH_PROVIDERS] INIT", {
  projectId: projectId ? `${projectId.slice(0, 8)}...` : "MISSING",
  env: process.env.NODE_ENV,
});

if (!projectId || projectId === "YOUR_PROJECT_ID") {
  console.error("[ETH_PROVIDERS] ❌ Missing NEXT_PUBLIC_WALLETCONNECT_ID in .env.local");
  console.error("[ETH_PROVIDERS] Get your Project ID from https://cloud.reown.com");
}

const config = getDefaultConfig({
  appName: "Token Migration Portal",
  projectId: projectId || "YOUR_PROJECT_ID",
  chains: [mainnet, sepolia],
  ssr: true,
});

export function EthProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log("[ETH_PROVIDERS] ✅ Mounted");
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading wallet providers...</p>
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

