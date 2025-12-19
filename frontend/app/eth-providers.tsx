"use client";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";
import { useState } from "react";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID;

if (!projectId || projectId === "YOUR_PROJECT_ID") {
  console.error("⚠️ Missing NEXT_PUBLIC_WALLETCONNECT_ID in .env.local");
  console.error("Get your Project ID from https://cloud.walletconnect.com");
}

const config = getDefaultConfig({
  appName: "Token Migration Portal",
  projectId: projectId || "YOUR_PROJECT_ID", // Will fail gracefully if not set
  chains: [mainnet, sepolia],
  ssr: true,
});

export function EthProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

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

