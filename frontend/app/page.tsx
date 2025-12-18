"use client";

import { useAccount, useConnect, useDisconnect, useExplorer, useProvider } from "@starknet-react/core";
import { useState, useCallback, useEffect } from "react";
import ControllerConnector from "@cartridge/connector/controller";

const PORTAL_ADDRESS = process.env.NEXT_PUBLIC_PORTAL_ADDRESS || "0x027d9db485a394d3aea0c3af6a82b889cb95a833cc4fe36ede8696624f0310fb";
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS || "0x07ef08eb2287fe9a996bb3de1e284b595fab5baae51374e0d8fc088c2d4334c9";

// Normalize addresses for comparison (handles padding, case, etc.)
const normalizeAddress = (addr: string): string => {
  if (!addr) return "";
  const clean = addr.replace(/^0x/i, "").toLowerCase();
  return "0x" + clean.padStart(64, "0");
};

// Claim data from merkle tree
const CLAIM_DATA = {
  address: "0x53371c2a24c3a9b7fcd60c70405e24e72d17a835e43c53bb465eee6e271044b",
  amount: "1000000000000000000", // 1 token (18 decimals)
  proof: [] as string[],
};

// Debug logger utility with timestamps
const debug = {
  log: (category: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    console.log(`[${timestamp}] 🔷 [${category}] ${message}`, data !== undefined ? data : '');
  },
  success: (category: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    console.log(`[${timestamp}] ✅ [${category}] ${message}`, data !== undefined ? data : '');
  },
  error: (category: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    console.error(`[${timestamp}] ❌ [${category}] ${message}`, data !== undefined ? data : '');
  },
  warn: (category: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    console.warn(`[${timestamp}] ⚠️ [${category}] ${message}`, data !== undefined ? data : '');
  },
};

export default function Home() {
  debug.log("RENDER", "Home component initializing");
  
  const { address, account, status, isConnected, chainId } = useAccount();
  const { connect, connectors, error: connectError, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const explorer = useExplorer();
  const { provider } = useProvider();
  
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugMessage = (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setDebugInfo(prev => [...prev.slice(-19), `[${timestamp}] ${msg}`]);
  };

  // Log connection state changes
  useEffect(() => {
    debug.log("STATE", "Connection state changed", { 
      status, 
      isConnected, 
      address: address || 'none',
      chainId: chainId || 'none',
      hasAccount: !!account,
    });
    addDebugMessage(`Status: ${status}, Connected: ${isConnected}, Address: ${address?.slice(0,10) || 'none'}`);
  }, [status, isConnected, address, chainId, account]);

  // Log connect errors
  useEffect(() => {
    if (connectError) {
      debug.error("CONNECT", "Connection error detected", {
        message: connectError.message,
        name: connectError.name,
        stack: connectError.stack,
      });
      addDebugMessage(`Connect Error: ${connectError.message}`);
    }
  }, [connectError]);

  // Log available connectors
  useEffect(() => {
    debug.log("CONNECTORS", "Available connectors", connectors.map(c => ({
      id: c.id,
      name: c.name,
      available: c.available,
    })));
  }, [connectors]);

  const controller = connectors[0] as ControllerConnector;
  const isEligible = normalizeAddress(address || "") === normalizeAddress(CLAIM_DATA.address);

  // Log eligibility check
  useEffect(() => {
    if (address) {
      debug.log("ELIGIBILITY", "Checking eligibility", {
        connectedAddress: address,
        expectedAddress: CLAIM_DATA.address,
        isEligible,
        addressMatch: address?.toLowerCase() === CLAIM_DATA.address.toLowerCase(),
      });
      addDebugMessage(`Eligibility: ${isEligible ? 'YES' : 'NO'} (${address.slice(0,10)}... vs ${CLAIM_DATA.address.slice(0,10)}...)`);
    }
  }, [address, isEligible]);

  const handleConnect = useCallback(async () => {
    debug.log("CONNECT", "Starting connection flow");
    addDebugMessage("Initiating wallet connection...");
    
    try {
      debug.log("CONNECT", "Controller connector details", {
        id: controller?.id,
        name: controller?.name,
        available: controller?.available,
      });
      
      if (!controller) {
        debug.error("CONNECT", "Controller connector not found");
        addDebugMessage("ERROR: Controller connector not available");
        return;
      }
      debug.log("CONNECT", "Calling connect() with controller");
      addDebugMessage("Calling connect()...");
      
      connect({ connector: controller });
      
      debug.success("CONNECT", "connect() called successfully");
      addDebugMessage("Connection initiated successfully");
    } catch (err: any) {
      debug.error("CONNECT", "Connection failed", {
        message: err?.message,
        code: err?.code,
        data: err?.data,
        stack: err?.stack,
      });
      addDebugMessage(`Connection failed: ${err?.message || 'Unknown error'}`);
    }
  }, [connect, controller]);

  const handleDisconnect = useCallback(async () => {
    debug.log("DISCONNECT", "Disconnecting wallet");
    addDebugMessage("Disconnecting...");
    
    try {
      await disconnect();
      debug.success("DISCONNECT", "Disconnected successfully");
      addDebugMessage("Disconnected");
      setClaimed(false);
      setTxHash(null);
      setError(null);
    } catch (err: any) {
      debug.error("DISCONNECT", "Disconnect failed", err);
      addDebugMessage(`Disconnect error: ${err?.message}`);
    }
  }, [disconnect]);

  const handleClaim = useCallback(async () => {
    debug.log("CLAIM", "=== STARTING CLAIM FLOW ===");
    addDebugMessage("=== Starting claim ===");
    
    if (!account) {
      debug.error("CLAIM", "No account available");
      addDebugMessage("ERROR: No account");
      return;
    }
    
    if (!isEligible) {
      debug.error("CLAIM", "Address not eligible");
      addDebugMessage("ERROR: Not eligible");
      return;
    }
    setClaiming(true);
    setError(null);
    try {
      // Log account details
      debug.log("CLAIM", "Account details", {
        address: account.address,
        // @ts-ignore - accessing internal properties for debug
        chainId: account.chainId,
      });
      addDebugMessage(`Account: ${account.address.slice(0,20)}...`);

      // Prepare calldata with proper u256 serialization
      const amountBigInt = BigInt(CLAIM_DATA.amount);
      const LOW_MASK = BigInt("0xffffffffffffffffffffffffffffffff"); // 128-bit mask
      const amountLow = "0x" + (amountBigInt & LOW_MASK).toString(16);
      const amountHigh = "0x" + (amountBigInt >> BigInt(128)).toString(16);
      
      // Proof serialization: Span<felt252> = (length, ...elements)
      const proofLength = CLAIM_DATA.proof.length.toString();
      
      const calldata = [amountLow, amountHigh, proofLength, ...CLAIM_DATA.proof];
      
      debug.log("CLAIM", "Prepared calldata", {
        amountRaw: CLAIM_DATA.amount,
        amountLow,
        amountHigh,
        proofLength,
        proof: CLAIM_DATA.proof,
        fullCalldata: calldata,
      });
      addDebugMessage(`Calldata: amount=${amountLow}, proof_len=${proofLength}`);

      // Prepare transaction
      const tx = {
        contractAddress: PORTAL_ADDRESS,
        entrypoint: "claim",
        calldata,
      };
      
      debug.log("CLAIM", "Transaction object", tx);
      addDebugMessage(`TX: ${PORTAL_ADDRESS.slice(0,15)}...::claim`);

      // Execute transaction (explicit array format for starknet v6)
      debug.log("CLAIM", "Calling account.execute()...");
      addDebugMessage("Executing transaction (should be invisible)...");
      
      const startTime = Date.now();
      const result = await account.execute([tx]); // Explicit array format
      const duration = Date.now() - startTime;
      
      debug.success("CLAIM", "Transaction submitted!", {
        transaction_hash: result.transaction_hash,
        duration_ms: duration,
      });
      addDebugMessage(`TX submitted in ${duration}ms: ${result.transaction_hash.slice(0,20)}...`);

      setTxHash(result.transaction_hash);

      // Wait for confirmation (optional)
      debug.log("CLAIM", "Waiting for transaction confirmation...");
      addDebugMessage("Waiting for confirmation...");
      
      if (provider) {
        try {
          // @ts-ignore - waitForTransaction types vary by provider version
          const receipt: any = await provider.waitForTransaction(result.transaction_hash);
          debug.success("CLAIM", "Transaction confirmed!", {
            transaction_hash: receipt?.transaction_hash || result.transaction_hash,
            receipt_type: receipt?.type || 'unknown',
          });
          addDebugMessage(`Confirmed! TX: ${result.transaction_hash.slice(0,20)}...`);
        } catch (waitErr: any) {
          debug.warn("CLAIM", "Could not wait for confirmation (non-fatal)", waitErr?.message);
          addDebugMessage(`Wait warning: ${waitErr?.message}`);
        }
      }

      setClaimed(true);
      debug.success("CLAIM", "=== CLAIM FLOW COMPLETE ===");
      addDebugMessage("=== Claim complete! ===");
      
    } catch (err: any) {
      debug.error("CLAIM", "Claim failed", {
        message: err?.message,
        code: err?.code,
        data: err?.data,
        revert_reason: err?.revert_reason,
        stack: err?.stack,
      });
      
      // Try to extract Starknet error message
      let errorMsg = err?.message || "Unknown error";
      if (err?.message?.includes("Error message:")) {
        errorMsg = err.message.match(/Error message: (.+)/)?.[1] || errorMsg;
      }
      if (err?.data?.revert_reason) {
        errorMsg = err.data.revert_reason;
      }
      
      addDebugMessage(`CLAIM ERROR: ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setClaiming(false);
    }
  }, [account, isEligible, provider]);

  const formatAmount = (raw: string) => {
    try {
      const value = BigInt(raw) / BigInt(10 ** 18);
      return value.toLocaleString();
    } catch {
      return raw;
    }
  };

  // Render
  debug.log("RENDER", "Rendering with state", { status, claiming, claimed, hasError: !!error });

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Token Migration Portal
        </h1>

        {/* Connection Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          {status === "disconnected" ? (
            <div className="text-center">
              <p className="mb-4 text-gray-400">Connect your wallet to check eligibility</p>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  isConnecting ? "bg-gray-600" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isConnecting ? "Connecting..." : "Connect Controller"}
              </button>
              {connectError && (
                <p className="mt-2 text-red-400 text-sm">{connectError.message}</p>
              )}
            </div>
          ) : status === "connecting" ? (
            <div className="text-center">
              <p className="text-yellow-400">Connecting...</p>
              <p className="text-gray-500 text-sm mt-2">Check for Cartridge popup</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Connected:</span>
                <span className="font-mono text-sm">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-400">Chain:</span>
                <span className="font-mono text-sm">{chainId || "unknown"}</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Claim Section */}
        {status === "connected" && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            {!isEligible ? (
              <div className="text-center">
                <p className="text-yellow-400 mb-2">This address is not eligible</p>
                <p className="text-gray-500 text-xs font-mono">
                  Connected: {address}
                </p>
                <p className="text-gray-500 text-xs font-mono">
                  Expected: {CLAIM_DATA.address}
                </p>
              </div>
            ) : claimed ? (
              <div className="text-center text-green-400">
                <p className="text-2xl mb-2">✓ Tokens Claimed!</p>
                {txHash && (
                  <a
                    href={explorer?.transaction(txHash) || `https://sepolia.voyager.online/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm"
                  >
                    View on Explorer →
                  </a>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-400 mb-2">You are eligible to claim:</p>
                <p className="text-4xl font-bold text-green-400 mb-6">
                  {formatAmount(CLAIM_DATA.amount)} TOKENS
                </p>
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className={`w-full py-4 rounded-lg font-semibold text-lg transition-colors ${
                    claiming
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {claiming ? "Claiming... (check console)" : "Claim Tokens"}
                </button>
                {error && (
                  <p className="mt-4 text-red-400 text-sm break-all">{error}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Debug Panel */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-400">🔧 Debug Log</h3>
            <button 
              onClick={() => setDebugInfo([])}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Clear
            </button>
          </div>
          <div className="font-mono text-xs text-gray-500 max-h-48 overflow-y-auto space-y-1">
            {debugInfo.length === 0 ? (
              <p className="text-gray-600">No debug messages yet... (Open DevTools Console for full logs)</p>
            ) : (
              debugInfo.map((msg, i) => (
                <p key={i} className={
                  msg.includes("ERROR") ? "text-red-400" :
                  msg.includes("===") ? "text-yellow-400" :
                  msg.includes("✅") || msg.includes("complete") ? "text-green-400" :
                  "text-gray-400"
                }>
                  {msg}
                </p>
              ))
            )}
          </div>
        </div>

        {/* Contract Info */}
        <div className="mt-6 text-center text-gray-600 text-xs font-mono">
          <p>Portal: {PORTAL_ADDRESS}</p>
          <p>Token: {TOKEN_ADDRESS}</p>
          <p>Network: Sepolia</p>
        </div>
      </div>
    </main>
  );
}
