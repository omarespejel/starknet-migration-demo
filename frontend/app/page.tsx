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
  const [debugExpanded, setDebugExpanded] = useState(true);
  
  // ✨ NEW: Track if this is first-time connection
  const [isFirstConnection, setIsFirstConnection] = useState(true);

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
    
    // ✨ NEW: Detect successful first connection
    if (isConnected && address && isFirstConnection) {
      setIsFirstConnection(false);
      addDebugMessage("✨ Session created! Future claims will be gasless");
      debug.success("SESSION", "First connection complete - session policies active");
    }
  }, [status, isConnected, address, chainId, account, isFirstConnection]);

  // Log connect errors with better messaging
  useEffect(() => {
    if (connectError) {
      debug.error("CONNECT", "Connection error detected", {
        message: connectError.message,
        name: connectError.name,
      });
      
      // ✨ NEW: User-friendly error messages
      if (connectError.message.includes("rejected") || 
          connectError.message.includes("denied") ||
          connectError.message.includes("cancelled")) {
        addDebugMessage(`❌ Connection cancelled - please try again`);
        setError("Connection was cancelled. Please click 'Connect Controller' to create your wallet.");
        
        // ✨ FIX: Reset error after a short delay to allow retry
        setTimeout(() => {
          setError(null);
        }, 3000); // Clear after 3 seconds
      } else {
        addDebugMessage(`❌ Connection error: ${connectError.message}`);
        setError(connectError.message);
      }
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
    addDebugMessage("🔐 Creating your Starknet wallet...");
    
    // ✨ NEW: Clear previous errors
    setError(null);
    
    try {
      if (!controller) {
        debug.error("CONNECT", "Controller connector not found");
        addDebugMessage("ERROR: Controller not available");
        setError("Wallet connector not initialized. Please refresh the page.");
        return;
      }
      
      debug.log("CONNECT", "Controller details", {
        id: controller.id,
        name: controller.name,
        available: controller.available,
      });
      
      debug.log("CONNECT", "Calling connect() - passkey prompt will appear");
      addDebugMessage("📱 Approve passkey creation (one-time setup)");
      
      connect({ connector: controller });
      
      debug.success("CONNECT", "connect() initiated - waiting for user approval");
      
    } catch (err: any) {
      debug.error("CONNECT", "Connection failed", {
        message: err?.message,
        code: err?.code,
      });
      addDebugMessage(`❌ Connection failed: ${err?.message || 'Unknown error'}`);
      setError(err?.message || 'Failed to connect. Please try again.');
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
      setIsFirstConnection(true); // Reset for next connection
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

      // ✨ NEW: Better messaging for session execution
      debug.log("CLAIM", "Executing with session keys (should be gasless & invisible)");
      addDebugMessage("🚀 Executing gasless transaction...");
      
      const startTime = Date.now();
      const result = await account.execute([tx]);
      const duration = Date.now() - startTime;
      
      debug.success("CLAIM", "Transaction submitted!", {
        transaction_hash: result.transaction_hash,
        duration_ms: duration,
      });
      addDebugMessage(`✅ Submitted in ${duration}ms (gasless!): ${result.transaction_hash.slice(0,20)}...`);

      setTxHash(result.transaction_hash);

      // Wait for confirmation
      debug.log("CLAIM", "Waiting for confirmation...");
      addDebugMessage("⏳ Confirming transaction...");
      
      if (provider) {
        try {
          // @ts-ignore - waitForTransaction types vary by provider version
          const receipt: any = await provider.waitForTransaction(result.transaction_hash);
          debug.success("CLAIM", "Transaction confirmed!", {
            transaction_hash: receipt?.transaction_hash || result.transaction_hash,
            status: receipt?.status || 'success',
          });
          addDebugMessage(`✅ Confirmed! Status: ${receipt?.status || 'success'}`);
        } catch (waitErr: any) {
          debug.warn("CLAIM", "Could not wait for confirmation (non-fatal)", waitErr?.message);
          addDebugMessage(`⚠️ Confirmation pending: ${waitErr?.message}`);
        }
      }

      setClaimed(true);
      debug.success("CLAIM", "=== CLAIM FLOW COMPLETE ===");
      addDebugMessage("🎉 Claim complete! Tokens will arrive shortly");
      
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
        <h1 className="text-4xl font-bold mb-2 text-center">
          Token Migration Portal
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Powered by Cartridge Controller
        </p>

        {/* Connection Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          {status === "disconnected" ? (
            <div className="text-center">
              {/* ✨ NEW: Better onboarding messaging */}
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-900/50 mb-4">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Create Your Starknet Wallet</h3>
                <p className="text-gray-400 text-sm mb-2">
                  One-time setup with passkey authentication
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Gasless claims
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    No popups after setup
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Secure
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setError(null); // Clear previous errors
                  handleConnect();
                }}
                disabled={isConnecting}
                className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 ${
                  isConnecting 
                    ? "bg-gray-600 cursor-wait" 
                    : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/50"
                }`}
              >
                {isConnecting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  "Connect Controller"
                )}
              </button>
              {/* ✨ NEW: Better error display */}
              {(connectError || error) && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                  <p className="text-red-400 text-sm flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error || connectError?.message}
                  </p>
                </div>
              )}
              <p className="mt-4 text-xs text-gray-500">
                By connecting, you'll approve a session for gasless token claims
              </p>
            </div>
          ) : status === "connecting" ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-900/50 mb-4">
                <svg className="animate-spin h-8 w-8 text-yellow-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-yellow-400 font-semibold">Connecting...</p>
              <p className="text-gray-500 text-sm mt-2">Check for Cartridge popup or passkey prompt</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-400">Connected Wallet:</span>
                <span className="font-mono text-sm bg-gray-700/50 px-3 py-1 rounded">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-400">Network:</span>
                <span className="font-mono text-sm bg-gray-700/50 px-3 py-1 rounded flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  {chainId?.toString() === "0x534e5f5345504f4c4941" ? "Sepolia" : chainId?.toString() || "unknown"}
                </span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-red-400 hover:text-red-300 text-sm transition-colors"
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
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-900/50 mb-4">
                  <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-yellow-400 mb-2 font-semibold">Not Eligible</p>
                <p className="text-gray-500 text-xs font-mono mb-1">Connected: {address?.slice(0,10)}...{address?.slice(-8)}</p>
                <p className="text-gray-500 text-xs font-mono">Expected: {CLAIM_DATA.address.slice(0,10)}...{CLAIM_DATA.address.slice(-8)}</p>
              </div>
            ) : claimed ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/50 mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-green-400 mb-4">✓ Tokens Claimed!</p>
                {txHash && (
                  <a
                    href={explorer?.transaction(txHash) || `https://sepolia.voyager.online/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    View on Explorer 
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-400 mb-2">You are eligible to claim:</p>
                <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-6">
                  {formatAmount(CLAIM_DATA.amount)} GGMT
                </p>
                
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className={`w-full py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 ${
                    claiming
                      ? "bg-gray-600 cursor-wait"
                      : "bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 shadow-lg shadow-green-500/50"
                  }`}
                >
                  {claiming ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Claiming (Gasless)...
                    </span>
                  ) : (
                    "Claim Tokens"
                  )}
                </button>
                {error && (
                  <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}
                <p className="mt-4 text-xs text-gray-500">
                  ⚡ This transaction is gasless - no fees required
                </p>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Debug Panel */}
        <div className="bg-gray-900 border-2 border-gray-700 rounded-lg p-6 mt-6">
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
              <div className="text-xs text-gray-500 mb-1">Connection Status</div>
              <div className={`text-sm font-mono font-bold ${
                status === "connected" ? "text-green-400" :
                status === "connecting" ? "text-yellow-400" :
                "text-red-400"
              }`}>
                {status.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Address</div>
              <div className="text-xs font-mono text-gray-300 break-all">
                {address || "Not connected"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Chain ID</div>
              <div className="text-xs font-mono text-gray-300">
                {chainId?.toString() || "N/A"}
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
              <div className="text-xs text-gray-500 mb-1">Has Account</div>
              <div className={`text-sm font-bold ${
                account ? "text-green-400" : "text-red-400"
              }`}>
                {account ? "YES" : "NO"}
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
              <div className="text-xs text-gray-500 mb-1">Claimed</div>
              <div className={`text-sm font-bold ${
                claimed ? "text-green-400" : "text-gray-400"
              }`}>
                {claimed ? "YES" : "NO"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Connectors</div>
              <div className="text-xs font-mono text-gray-300">
                {connectors.length} available
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
              <div>
                <span className="text-gray-500">Expected Address:</span>{" "}
                <span className="text-gray-300 break-all">{CLAIM_DATA.address}</span>
              </div>
              <div>
                <span className="text-gray-500">Claim Amount:</span>{" "}
                <span className="text-green-400">{CLAIM_DATA.amount}</span>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded">
              <div className="text-xs text-red-400 font-semibold mb-1">❌ Error</div>
              <div className="text-sm font-mono text-red-300 break-all">{error}</div>
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
