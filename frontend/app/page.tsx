"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount as useEthAccount, useSignMessage } from "wagmi";
import { useAccount as useStarknetAccount, useConnect, useDisconnect, useExplorer, useProvider } from "@starknet-react/core";
import { useState, useEffect, useCallback } from "react";
import { CallData } from "starknet";
import { PORTAL_ADDRESS, TOKEN_ADDRESS, getStarkscanUrl } from "@/lib/constants";
import { fetchAllocation } from "@/lib/merkle";

// Create deterministic message for verification
const createMigrationMessage = (ethAddress: string, starknetAddress: string) => `
Token Migration Authorization

I authorize the migration of my tokens from L1 to Starknet.

L1 Address: ${ethAddress}
Starknet Address: ${starknetAddress}
Timestamp: ${Date.now()}

This signature proves ownership and authorizes the claim.
`.trim();

export default function Home() {
  // Migration state - declare ALL state first
  const [signature, setSignature] = useState<string | null>(null);
  const [migrationStep, setMigrationStep] = useState<1 | 2 | 3>(1);
  const [claimAmount, setClaimAmount] = useState<string>("0");
  const [claimProof, setClaimProof] = useState<string[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loadingAllocation, setLoadingAllocation] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [debugExpanded, setDebugExpanded] = useState(true);

  // Ethereum/MetaMask state
  const { address: ethAddress, isConnected: ethConnected } = useEthAccount();
  const { signMessage, isPending: isSigning } = useSignMessage({
    mutation: {
      onSuccess: (sig) => {
        if (process.env.NODE_ENV === 'development') {
          console.log("Signature:", sig);
        }
        setSignature(sig);
        addDebugMessage(`✅ Signature received: ${sig.slice(0, 20)}...`);
      },
      onError: (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error("Signature error:", error);
        }
        setClaimError("Failed to sign message. Please try again.");
        addDebugMessage(`❌ Signature error: ${error.message}`);
      },
    },
  });

  // Starknet/Cartridge Controller state
  const { address: starknetAddress, account, status: starknetStatus } = useStarknetAccount();
  const { connect, connectors, disconnect } = useConnect();
  const explorer = useExplorer();
  const { provider } = useProvider();
  const controllerConnector = connectors.find((c) => c.id === "controller");

  const addDebugMessage = (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setDebugInfo(prev => [...prev.slice(-19), `[${timestamp}] ${msg}`]);
  };

  // Fetch merkle proof when ETH address is available (eligibility based on L1 snapshot)
  useEffect(() => {
    if (!ethAddress) return;

    // Debounce to prevent rapid-fire requests
    const timeoutId = setTimeout(async () => {
      setLoadingAllocation(true);
      setClaimError(null);
      addDebugMessage(`🔍 Checking eligibility for ETH address: ${ethAddress.slice(0, 10)}...`);

      try {
        // Lookup by ETH address - this is the L1 snapshot
        const data = await fetchAllocation(ethAddress, starknetAddress || '');
        
        if (data) {
          setClaimAmount(data.amount);
          setClaimProof(data.proof);
          setIsEligible(true);
          addDebugMessage(`✅ Eligible! Amount: ${(Number(data.amount) / 1e18).toLocaleString()} tokens`);
        } else {
          setIsEligible(false);
          setClaimError("ETH address not found in snapshot. You may not be eligible for this migration.");
          addDebugMessage(`❌ Not eligible - address not in snapshot`);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("Error loading allocation:", error);
        }
        setClaimError("Failed to load allocation data. Please try again.");
        setIsEligible(false);
        addDebugMessage(`❌ Error loading allocation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoadingAllocation(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [ethAddress]); // Only depends on ethAddress now

  // Advance to step 2 when MetaMask connects AND we know eligibility
  useEffect(() => {
    if (ethConnected && !loadingAllocation && migrationStep === 1) {
      setMigrationStep(2);
      addDebugMessage(`📝 Step 2: Connect Starknet wallet`);
    }
  }, [ethConnected, loadingAllocation, migrationStep]);

  // Advance to step 3 when Starknet connects AND eligible
  useEffect(() => {
    if (starknetStatus === 'connected' && isEligible && migrationStep === 2) {
      setMigrationStep(3);
      addDebugMessage(`🎯 Step 3: Ready to claim tokens`);
    }
  }, [starknetStatus, isEligible, migrationStep]);

  // Step 1: Connect MetaMask (signing happens after both wallets connected)
  // Step 2: Sign message to prove L1 ownership (requires both addresses)
  const handleSignMigration = () => {
    if (!ethAddress || !starknetAddress) {
      setClaimError("Please connect both wallets before signing");
      return;
    }
    
    const message = createMigrationMessage(ethAddress, starknetAddress);
    addDebugMessage(`✍️ Requesting signature from MetaMask...`);
    signMessage({ message });
  };

  // Step 2: Connect Cartridge Controller
  const handleConnectController = useCallback(async () => {
    if (controllerConnector) {
      addDebugMessage(`🔐 Connecting Cartridge Controller...`);
      connect({ connector: controllerConnector });
    }
  }, [connect, controllerConnector]);

  const handleDisconnect = useCallback(async () => {
    addDebugMessage("Disconnecting...");
    await disconnect();
    setTxHash(null);
    setClaimError(null);
    setMigrationStep(1);
    setSignature(null);
    setIsEligible(false);
    addDebugMessage("Disconnected");
  }, [disconnect]);

  // Step 3: Claim tokens on Starknet
  const handleClaim = async () => {
    // Enhanced guard clause with logging
    if (!account || !claimAmount || claiming || !isEligible) {
      if (process.env.NODE_ENV === 'development') {
        console.log("[CLAIM] Guard failed:", { 
          account: !!account, 
          claimAmount, 
          claiming, 
          isEligible 
        });
      }
      if (!isEligible) {
        setClaimError("You are not eligible to claim tokens. Please check your address.");
      }
      return;
    }

    setClaiming(true);
    setClaimError(null);
    addDebugMessage(`🚀 Starting claim transaction...`);

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log("[CLAIM] Starting claim with:", { 
          claimAmount, 
          proofLength: claimProof.length,
          accountAddress: account.address,
          portalAddress: PORTAL_ADDRESS
        });
      }

      // Convert amount to u256 (low, high)
      const amount = BigInt(claimAmount);
      const amountLow = amount & BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
      const amountHigh = amount >> BigInt(128);

      // Prepare calldata for claim function
      const calldata = CallData.compile({
        amount: {
          low: amountLow.toString(),
          high: amountHigh.toString(),
        },
        proof: claimProof,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log("[CLAIM] Executing with calldata:", calldata);
      }

      // Execute claim transaction
      const result = await account.execute({
        contractAddress: PORTAL_ADDRESS,
        entrypoint: "claim",
        calldata: calldata,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log("[CLAIM] Result:", result);
      }

      // Validate result
      if (result?.transaction_hash) {
        setTxHash(result.transaction_hash);
        addDebugMessage(`✅ Transaction submitted: ${result.transaction_hash.slice(0, 20)}...`);
        if (process.env.NODE_ENV === 'development') {
          console.log("[CLAIM] Success! Transaction hash:", result.transaction_hash);
        }
      } else {
        throw new Error("No transaction hash returned from account.execute");
      }
    } catch (err: unknown) {
      // Safe error handling - err might be undefined or not an Error
      if (process.env.NODE_ENV === 'development') {
        console.error("[CLAIM] Error:", err);
      }
      
      let errorMessage = "Failed to claim tokens";
      
      if (err instanceof Error) {
        errorMessage = err.message || errorMessage;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String(err.message);
      }
      
      setClaimError(errorMessage);
      addDebugMessage(`❌ Claim error: ${errorMessage}`);
    } finally {
      setClaiming(false);
    }
  };

  const formatAmount = (raw: string) => {
    try {
      const value = BigInt(raw) / BigInt(10 ** 18);
      return value.toLocaleString();
    } catch {
      return raw;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Token Migration Portal</h1>
          <p className="text-gray-400">
            Migrate your tokens from L1 to Starknet
          </p>
        </div>

        {/* Step 1: Connect MetaMask & Sign */}
        <div
          className={`p-6 rounded-xl border ${
            migrationStep >= 1
              ? "border-blue-500 bg-gray-800"
              : "border-gray-700 bg-gray-800/50"
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">
              1
            </span>
            <h2 className="text-xl font-semibold">
              Connect L1 Wallet & Authorize
            </h2>
          </div>

          {!ethConnected ? (
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-sm text-gray-400">Connected (Ethereum/L1)</p>
                <p className="font-mono text-sm break-all">{ethAddress}</p>
              </div>

              {loadingAllocation && (
                <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3">
                  <p className="text-blue-400 text-sm">Checking eligibility...</p>
                </div>
              )}

              {!signature ? (
                <div className="space-y-2">
                  {!starknetAddress && (
                    <p className="text-sm text-yellow-400">
                      ⚠️ Connect Starknet wallet (Step 2) before signing
                    </p>
                  )}
                  <button
                    onClick={handleSignMigration}
                    disabled={isSigning || !starknetAddress || loadingAllocation}
                    className="w-full py-3 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded-lg font-medium transition"
                  >
                    {isSigning 
                      ? "Sign in MetaMask..." 
                      : !starknetAddress
                      ? "Connect Starknet wallet first (Step 2)"
                      : loadingAllocation
                      ? "Checking eligibility..."
                      : "Sign Migration Authorization"}
                  </button>
                </div>
              ) : (
                <div className="bg-green-900/30 border border-green-600 rounded-lg p-3">
                  <p className="text-green-400 font-medium">
                    ✓ Migration authorized
                  </p>
                  <p className="text-xs text-gray-400 mt-1 break-all">
                    Signature: {signature.slice(0, 20)}...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Connect Cartridge Controller */}
        <div
          className={`p-6 rounded-xl border ${
            migrationStep >= 2
              ? "border-purple-500 bg-gray-800"
              : "border-gray-700 bg-gray-800/50"
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                migrationStep >= 2 ? "bg-purple-600" : "bg-gray-600"
              }`}
            >
              2
            </span>
            <h2 className="text-xl font-semibold">Connect Starknet Wallet</h2>
          </div>

          {migrationStep < 2 ? (
            <p className="text-gray-500">Complete step 1 first</p>
          ) : starknetStatus !== "connected" ? (
            <button
              onClick={handleConnectController}
              className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
            >
              Connect Controller (Passkey)
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-sm text-gray-400">Connected (Starknet)</p>
                <p className="font-mono text-sm break-all">{starknetAddress}</p>
              </div>
              
              {loadingAllocation && (
                <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3">
                  <p className="text-blue-400 text-sm">Loading allocation data...</p>
                </div>
              )}
              
              {!loadingAllocation && isEligible && migrationStep === 2 && (
                <div className="bg-green-900/30 border border-green-600 rounded-lg p-3">
                  <p className="text-green-400 text-sm">✓ Eligible for migration</p>
                </div>
              )}
              
              {!loadingAllocation && !isEligible && claimError && (
                <div className="bg-red-900/30 border border-red-600 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{claimError}</p>
                </div>
              )}

              {starknetStatus === "connected" && (
                <button
                  onClick={handleDisconnect}
                  className="text-red-400 hover:text-red-300 text-sm transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Claim Tokens */}
        <div
          className={`p-6 rounded-xl border ${
            migrationStep >= 3
              ? "border-green-500 bg-gray-800"
              : "border-gray-700 bg-gray-800/50"
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                migrationStep >= 3 ? "bg-green-600" : "bg-gray-600"
              }`}
            >
              3
            </span>
            <h2 className="text-xl font-semibold">Claim on Starknet</h2>
          </div>

          {migrationStep < 3 ? (
            <p className="text-gray-500">Complete previous steps first</p>
          ) : !isEligible ? (
            <div className="space-y-4">
              <div className="bg-red-900/30 border border-red-600 rounded-lg p-4">
                <p className="text-red-400 font-medium">Not Eligible</p>
                <p className="text-sm text-red-300 mt-2">
                  {claimError || "Your address is not in the migration snapshot."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 mb-2">You will receive:</p>
                <p className="text-3xl font-bold text-green-400">
                  {claimAmount && claimAmount !== "0" 
                    ? formatAmount(claimAmount)
                    : "0"} tokens
                </p>
              </div>

              {claimError && (
                <div className="bg-red-900/30 border border-red-600 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{claimError}</p>
                </div>
              )}

              {txHash && (
                <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3">
                  <p className="text-blue-400 text-sm mb-1">
                    ✓ Transaction submitted!
                  </p>
                  <a
                    href={getStarkscanUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 text-xs underline break-all"
                  >
                    View on Starkscan: {txHash.slice(0, 20)}...
                  </a>
                </div>
              )}

              <button
                onClick={handleClaim}
                disabled={claiming || !account || !!txHash || !isEligible}
                className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-bold text-lg transition"
              >
                {claiming
                  ? "Claiming..."
                  : txHash
                  ? "Claimed ✓"
                  : "Claim Tokens"}
              </button>
            </div>
          )}
        </div>

        {/* Enhanced Debug Panel */}
        <div className="bg-gray-900 border-2 border-gray-700 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-300 flex items-center gap-2">
              🔧 Debug Panel
              <span className="text-xs font-normal text-gray-500">
                ({debugInfo.length} messages)
              </span>
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setDebugExpanded(!debugExpanded)}
                className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
              >
                {debugExpanded ? "Collapse" : "Expand"}
              </button>
              <button 
                onClick={() => setDebugInfo([])}
                className="text-xs px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-gray-300"
              >
                Clear
              </button>
            </div>
          </div>

          {/* System State Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-800 rounded border border-gray-700">
            <div>
              <div className="text-xs text-gray-500 mb-1">ETH Status</div>
              <div className={`text-sm font-mono font-bold ${
                ethConnected ? "text-green-400" : "text-red-400"
              }`}>
                {ethConnected ? "CONNECTED" : "DISCONNECTED"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Starknet Status</div>
              <div className={`text-sm font-mono font-bold ${
                starknetStatus === "connected" ? "text-green-400" :
                starknetStatus === "connecting" ? "text-yellow-400" :
                "text-red-400"
              }`}>
                {starknetStatus?.toUpperCase() || "DISCONNECTED"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">ETH Address</div>
              <div className="text-xs font-mono text-gray-300 break-all">
                {ethAddress || "Not connected"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Starknet Address</div>
              <div className="text-xs font-mono text-gray-300 break-all">
                {starknetAddress || "Not connected"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Signature</div>
              <div className="text-xs font-mono text-gray-300 break-all">
                {signature ? `${signature.slice(0, 20)}...` : "Not signed"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Step</div>
              <div className="text-sm font-bold text-gray-300">
                {migrationStep}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Eligible</div>
              <div className={`text-sm font-bold ${
                isEligible ? "text-green-400" : "text-red-400"
              }`}>
                {isEligible ? "YES" : "NO"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Claim Amount</div>
              <div className="text-xs font-mono text-gray-300">
                {claimAmount}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Claiming</div>
              <div className={`text-sm font-bold ${
                claiming ? "text-yellow-400" : "text-gray-400"
              }`}>
                {claiming ? "YES" : "NO"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Has Account</div>
              <div className={`text-sm font-bold ${
                account ? "text-green-400" : "text-red-400"
              }`}>
                {account ? "YES" : "NO"}
              </div>
            </div>
          </div>

          {/* Contract Info */}
          <div className="mb-4 p-4 bg-gray-800 rounded border border-gray-700">
            <div className="text-xs text-gray-500 mb-2 font-semibold">Contract Addresses</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-gray-500">Portal:</span>{" "}
                <span className="text-gray-300 break-all">{PORTAL_ADDRESS}</span>
              </div>
              <div>
                <span className="text-gray-500">Token:</span>{" "}
                <span className="text-gray-300 break-all">{TOKEN_ADDRESS}</span>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {claimError && (
            <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded">
              <div className="text-xs text-red-400 font-semibold mb-1">❌ Error</div>
              <div className="text-sm font-mono text-red-300 break-all">{claimError}</div>
            </div>
          )}

          {/* Transaction Hash */}
          {txHash && (
            <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded">
              <div className="text-xs text-green-400 font-semibold mb-1">✅ Transaction Hash</div>
              <div className="text-sm font-mono text-green-300 break-all">{txHash}</div>
            </div>
          )}

          {/* Debug Log Messages */}
          {debugExpanded && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs text-gray-500 font-semibold">Debug Messages ({debugInfo.length})</div>
                <div className="text-xs text-gray-600">
                  Last {Math.min(debugInfo.length, 50)} shown
                </div>
              </div>
              <div className="font-mono text-xs text-gray-400 max-h-96 overflow-y-auto space-y-1 p-3 bg-black/50 rounded border border-gray-800">
                {debugInfo.length === 0 ? (
                  <p className="text-gray-600 italic">No debug messages yet... Actions will appear here</p>
                ) : (
                  debugInfo.slice(-50).map((msg, i) => (
                    <p key={i} className={
                      msg.includes("ERROR") || msg.includes("❌") ? "text-red-400" :
                      msg.includes("===") || msg.includes("⚠️") ? "text-yellow-400" :
                      msg.includes("✅") || msg.includes("complete") || msg.includes("SUCCESS") ? "text-green-400" :
                      msg.includes("CONNECT") ? "text-blue-400" :
                      msg.includes("CLAIM") ? "text-purple-400" :
                      "text-gray-400"
                    }>
                      {msg}
                    </p>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
