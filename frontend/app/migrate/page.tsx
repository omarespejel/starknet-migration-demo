"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount as useEthAccount, useSignMessage } from "wagmi";
import { useAccount as useStarknetAccount, useConnect } from "@starknet-react/core";
import { useState, useEffect } from "react";
import { CallData } from "starknet";
import { PORTAL_ADDRESS } from "@/lib/constants";

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
        console.log("Signature:", sig);
        setSignature(sig);
        setMigrationStep(2);
      },
    },
  });

  // Starknet/Cartridge Controller state
  const { address: starknetAddress, account, status: starknetStatus } = useStarknetAccount();
  const { connect, connectors } = useConnect();
  const controllerConnector = connectors.find((c) => c.id === "controller");

  // Migration state
  const [signature, setSignature] = useState<string | null>(null);
  const [migrationStep, setMigrationStep] = useState<1 | 2 | 3>(1);
  const [claimAmount, setClaimAmount] = useState<string>("1000000000000000000"); // 1 token
  const [claimProof, setClaimProof] = useState<string[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Fetch merkle proof when both addresses are available
  useEffect(() => {
    if (ethAddress && starknetAddress && migrationStep >= 2) {
      // In production, this would fetch from your backend/merkle tree
      // For now, using the updated merkle tree data
      const merkleData = {
        address: "0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152",
        amount: "1000000000000000000",
        proof: [] as string[],
      };
      
      // Check if the starknet address matches
      const normalizedStarknet = starknetAddress?.toLowerCase().replace(/^0x/, "").padStart(64, "0");
      const normalizedMerkle = merkleData.address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
      
      if (normalizedStarknet === normalizedMerkle) {
        setClaimAmount(merkleData.amount);
        setClaimProof(merkleData.proof);
        if (migrationStep === 2) {
          setMigrationStep(3);
        }
      }
    }
  }, [ethAddress, starknetAddress, migrationStep]);

  // Step 1: Sign message to prove IMX ownership
  const handleSignMigration = () => {
    if (!ethAddress) return;
    
    const message = createMigrationMessage(
      ethAddress,
      starknetAddress || "0x0" // Will be updated when Starknet connects
    );
    
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
      console.log("Claim transaction:", result.transaction_hash);
    } catch (err: any) {
      console.error("Claim error:", err);
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
                <button
                  onClick={handleSignMigration}
                  disabled={isSigning}
                  className="w-full py-3 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded-lg font-medium transition"
                >
                  {isSigning ? "Sign in MetaMask..." : "Sign Migration Authorization"}
                </button>
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
              {migrationStep === 2 && (
                <button
                  onClick={() => setMigrationStep(3)}
                  className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition"
                >
                  Continue to Claim
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
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 mb-2">You will receive:</p>
                <p className="text-3xl font-bold text-green-400">
                  {claimAmount ? (Number(claimAmount) / 1e18).toLocaleString() : "0"} GGMT
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
                    href={`https://sepolia.starkscan.co/tx/${txHash}`}
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

