"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount as useEthAccount, useSignMessage } from "wagmi";
import { useAccount as useStarknetAccount, useConnect } from "@starknet-react/core";
import { useState, useEffect } from "react";
import { CallData } from "starknet";
import { PORTAL_ADDRESS, getStarkscanUrl } from "@/lib/constants";
import { fetchAllocation } from "@/lib/merkle";

// Create deterministic message for verification
const createMigrationMessage = (ethAddress: string, starknetAddress: string) => `
GGMT Token Migration Authorization

I authorize the migration of my GGMT tokens from IMX to Starknet.

IMX Address: ${ethAddress}
Starknet Address: ${starknetAddress}
Timestamp: ${Date.now()}

This signature proves ownership and authorizes the claim.
`.trim();

export default function MigrationPage() {
  // Ethereum/MetaMask state
  const { address: ethAddress, isConnected: ethConnected } = useEthAccount();
  const { signMessage, isPending: isSigning } = useSignMessage({
    mutation: {
      onSuccess: (sig) => {
        if (process.env.NODE_ENV === 'development') {
          console.log("Signature:", sig);
        }
        setSignature(sig);
        // Don't advance step here - let useEffect handle it based on allocation fetch
      },
      onError: (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error("Signature error:", error);
        }
        setClaimError("Failed to sign message. Please try again.");
      },
    },
  });

  // Starknet/Cartridge Controller state
  const { address: starknetAddress, account, status: starknetStatus } = useStarknetAccount();
  const { connect, connectors } = useConnect();
  const controllerConnector = connectors.find((c) => c.id === "controller");

  // Advance to step 2 when MetaMask connects
  useEffect(() => {
    if (ethConnected && migrationStep === 1) {
      setMigrationStep(2);
    }
  }, [ethConnected, migrationStep]);

  // Migration state
  const [signature, setSignature] = useState<string | null>(null);
  const [migrationStep, setMigrationStep] = useState<1 | 2 | 3>(1);
  const [claimAmount, setClaimAmount] = useState<string>("0");
  const [claimProof, setClaimProof] = useState<string[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loadingAllocation, setLoadingAllocation] = useState(false);
  const [isEligible, setIsEligible] = useState(false);

  // Fetch merkle proof when both addresses are available (with debounce)
  useEffect(() => {
    if (!starknetAddress || migrationStep < 2) return;

    // Debounce to prevent rapid-fire requests
    const timeoutId = setTimeout(async () => {
      setLoadingAllocation(true);
      setClaimError(null);

      try {
        const data = await fetchAllocation(ethAddress || '', starknetAddress);
        
        if (data) {
          setClaimAmount(data.amount);
          setClaimProof(data.proof);
          setIsEligible(true);
          // Automatically advance to step 3 if eligible
          if (migrationStep === 2) {
            setMigrationStep(3);
          }
        } else {
          setIsEligible(false);
          setClaimError("Address not found in snapshot. You may not be eligible for this migration.");
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("Error loading allocation:", error);
        }
        setClaimError("Failed to load allocation data. Please try again.");
        setIsEligible(false);
      } finally {
        setLoadingAllocation(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [ethAddress, starknetAddress, migrationStep]);

  // Step 1: Connect MetaMask (signing happens after both wallets connected)
  // Step 2: Sign message to prove IMX ownership (requires both addresses)
  const handleSignMigration = () => {
    if (!ethAddress || !starknetAddress) {
      setClaimError("Please connect both wallets before signing");
      return;
    }
    
    const message = createMigrationMessage(ethAddress, starknetAddress);
    signMessage({ message });
  };

  // Step 2: Connect Cartridge Controller
  const handleConnectController = () => {
    if (controllerConnector) {
      connect({ connector: controllerConnector });
    }
  };

  // Step 3: Claim tokens on Starknet
  const handleClaim = async () => {
    if (!account || !claimAmount || claiming) return;

    setClaiming(true);
    setClaimError(null);

    try {
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

      // Execute claim transaction
      const result = await account.execute({
        contractAddress: PORTAL_ADDRESS,
        entrypoint: "claim",
        calldata: calldata,
      });

      setTxHash(result.transaction_hash);
      if (process.env.NODE_ENV === 'development') {
        console.log("Claim transaction:", result.transaction_hash);
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Claim error:", err);
      }
      setClaimError(err.message || "Failed to claim tokens");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">GGMT Token Migration</h1>
          <p className="text-gray-400">
            Migrate your tokens from IMX to Starknet
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
              Connect IMX Wallet & Authorize
            </h2>
          </div>

          {!ethConnected ? (
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-sm text-gray-400">Connected (Ethereum/IMX)</p>
                <p className="font-mono text-sm break-all">{ethAddress}</p>
              </div>

              {!signature ? (
                <div className="space-y-2">
                  {!starknetAddress && (
                    <p className="text-sm text-yellow-400">
                      ⚠️ Connect Starknet wallet (Step 2) before signing
                    </p>
                  )}
                  <button
                    onClick={handleSignMigration}
                    disabled={isSigning || !starknetAddress}
                    className="w-full py-3 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded-lg font-medium transition"
                  >
                    {isSigning 
                      ? "Sign in MetaMask..." 
                      : !starknetAddress
                      ? "Connect Starknet wallet first (Step 2)"
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
                    ? (Number(claimAmount) / 1e18).toLocaleString() 
                    : "0"} GGMT
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
                disabled={claiming || !account || !!txHash}
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

        {/* Debug Info */}
        <details className="bg-gray-800 rounded-lg p-4">
          <summary className="cursor-pointer text-sm text-gray-400">
            Debug Info
          </summary>
          <div className="mt-4 space-y-2 text-xs font-mono">
            <div>
              <span className="text-gray-500">ETH Address:</span>{" "}
              {ethAddress || "Not connected"}
            </div>
            <div>
              <span className="text-gray-500">Starknet Address:</span>{" "}
              {starknetAddress || "Not connected"}
            </div>
            <div>
              <span className="text-gray-500">Signature:</span>{" "}
              {signature ? `${signature.slice(0, 20)}...` : "Not signed"}
            </div>
            <div>
              <span className="text-gray-500">Step:</span> {migrationStep}
            </div>
            <div>
              <span className="text-gray-500">Claim Amount:</span> {claimAmount}
            </div>
          </div>
        </details>
      </div>
    </main>
  );
}

