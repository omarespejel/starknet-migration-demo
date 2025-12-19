"use client";

/**
 * Token Migration Portal - Main Page Component
 * 
 * This component implements a three-step migration flow that enables users to migrate
 * tokens from an L1 chain (Ethereum) to Starknet. The architecture uses a dual-wallet
 * approach: Ethereum wallet for proving ownership, Starknet wallet for receiving tokens.
 * 
 * Architecture:
 * - Step 1: Connect Ethereum wallet (MetaMask) and verify eligibility via merkle tree
 * - Step 2: Connect Starknet wallet (Cartridge Controller) and sign authorization message
 * - Step 3: Execute claim transaction on Starknet (gasless via Cartridge session keys)
 * 
 * Key Technical Concepts:
 * - Merkle Tree: Cryptographic proof structure for efficient eligibility verification
 * - Session Keys: Pre-authorized signing keys enabling gasless transactions
 * - Dual-Wallet: Separate wallets for different purposes (proof vs execution)
 */

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount as useEthAccount, useSignMessage } from "wagmi";
import { useAccount as useStarknetAccount, useConnect, useDisconnect, useExplorer, useProvider } from "@starknet-react/core";
import { useState, useEffect, useCallback } from "react";
import { PORTAL_ADDRESS, TOKEN_ADDRESS, getStarkscanUrl } from "@/lib/constants";
import { fetchAllocation } from "@/lib/merkle";

/**
 * Creates a deterministic authorization message that binds an Ethereum address
 * to a Starknet address. The user signs this message with their Ethereum wallet
 * to prove ownership and authorize the migration.
 * 
 * Why include both addresses? This creates a cryptographic link between the L1
 * address (in the merkle snapshot) and the L2 address (where tokens will be minted).
 * In production, a backend service would verify this signature before allowing claims.
 */
const createMigrationMessage = (ethAddress: string, starknetAddress: string) => `
Token Migration Authorization

I authorize the migration of my tokens from L1 to Starknet.

L1 Address: ${ethAddress}
Starknet Address: ${starknetAddress}
Timestamp: ${Date.now()}

This signature proves ownership and authorizes the claim.
`.trim();

export default function Home() {
  /**
   * State Management
   * 
   * We declare all state variables first to avoid "used before declaration" errors.
   * This follows React best practices and ensures proper dependency tracking.
   */
  
  // Migration flow state
  const [signature, setSignature] = useState<string | null>(null); // Ethereum signature authorizing migration
  const [migrationStep, setMigrationStep] = useState<1 | 2 | 3>(1); // Current step in 3-step flow
  const [claimAmount, setClaimAmount] = useState<string>("0"); // Token amount from merkle tree (wei format)
  const [claimProof, setClaimProof] = useState<string[]>([]); // Merkle proof array for on-chain verification
  const [claiming, setClaiming] = useState(false); // Transaction in progress flag
  const [claimError, setClaimError] = useState<string | null>(null); // User-facing error messages
  const [txHash, setTxHash] = useState<string | null>(null); // Starknet transaction hash after claim
  const [loadingAllocation, setLoadingAllocation] = useState(false); // Merkle tree lookup in progress
  const [isEligible, setIsEligible] = useState(false); // Whether ETH address exists in merkle tree
  const [debugInfo, setDebugInfo] = useState<string[]>([]); // Debug log messages for developers
  const [debugExpanded, setDebugExpanded] = useState(true); // Debug panel visibility

  /**
   * Ethereum Wallet Integration (wagmi + RainbowKit)
   * 
   * useEthAccount: Reads connected Ethereum address and connection status
   * useSignMessage: Provides message signing functionality (EIP-191 standard)
   * 
   * Why wagmi? It provides a clean React API for Ethereum interactions and handles
   * wallet connection state management automatically.
   */
  const { address: ethAddress, isConnected: ethConnected } = useEthAccount();
  const { signMessage, isPending: isSigning } = useSignMessage({
    mutation: {
      onSuccess: (sig) => {
        if (process.env.NODE_ENV === 'development') {
          console.log("Signature:", sig);
        }
        setSignature(sig);
        addDebugMessage(`Signature received: ${sig.slice(0, 20)}...`);
      },
      onError: (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error("Signature error:", error);
        }
        setClaimError("Failed to sign message. Please try again.");
        addDebugMessage(`Signature error: ${error.message}`);
      },
    },
  });

  /**
   * Starknet Wallet Integration (Starknet React + Cartridge Controller)
   * 
   * useStarknetAccount: Reads connected Starknet address and account object
   * useConnect: Provides connection functionality for Starknet wallets
   * useDisconnect: Handles wallet disconnection
   * useExplorer: Generates explorer URLs for transactions
   * useProvider: Provides RPC provider for transaction queries
   * 
   * Cartridge Controller: A smart wallet that uses session keys for gasless transactions.
   * After initial connection, transactions matching approved policies execute automatically
   * without user interaction or gas fees.
   */
  const { address: starknetAddress, account, status: starknetStatus } = useStarknetAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const explorer = useExplorer();
  const { provider } = useProvider();
  const controllerConnector = connectors.find((c) => c.id === "controller");

  const addDebugMessage = (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setDebugInfo(prev => [...prev.slice(-19), `[${timestamp}] ${msg}`]);
  };

  /**
   * Eligibility Check: Merkle Tree Lookup
   * 
   * When a user connects their Ethereum wallet, we immediately check if their address
   * exists in the merkle tree snapshot. The merkle tree is generated from a snapshot
   * of all eligible L1 addresses and their token amounts.
   * 
   * How it works:
   * 1. User connects Ethereum wallet → ethAddress becomes available
   * 2. We fetch merkle-tree.json from the public folder
   * 3. We search for the normalized ETH address in the claims array
   * 4. If found, we store the amount and proof for later use
   * 
   * Why debounce? Prevents multiple API calls if the address changes rapidly
   * (e.g., user switching accounts quickly).
   * 
   * Why ETH address only? The migration snapshot is based on L1 addresses. The Starknet
   * address is chosen by the user and doesn't affect eligibility.
   */
  useEffect(() => {
    if (!ethAddress) return;

    // Debounce to prevent rapid-fire requests when address changes
    const timeoutId = setTimeout(async () => {
      setLoadingAllocation(true);
      setClaimError(null);
      addDebugMessage(`Checking eligibility for ETH address: ${ethAddress.slice(0, 10)}...`);

      try {
        // Lookup by ETH address - this matches the L1 snapshot used to generate the merkle tree
        const data = await fetchAllocation(ethAddress, starknetAddress || '');
        
        if (data) {
          // Store the allocation data for the claim transaction
          setClaimAmount(data.amount);
          setClaimProof(data.proof);
          setIsEligible(true);
          addDebugMessage(`Eligible! Amount: ${(Number(data.amount) / 1e18).toLocaleString()} tokens`);
        } else {
          // Address not found in merkle tree - user is not eligible
          setIsEligible(false);
          setClaimError("ETH address not found in snapshot. You may not be eligible for this migration.");
          addDebugMessage(`Not eligible - address not in snapshot`);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("Error loading allocation:", error);
        }
        setClaimError("Failed to load allocation data. Please try again.");
        setIsEligible(false);
        addDebugMessage(`Error loading allocation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoadingAllocation(false);
      }
    }, 300); // 300ms debounce prevents excessive API calls

    return () => clearTimeout(timeoutId);
  }, [ethAddress]); // Re-run when Ethereum address changes

  // Advance to step 2 when MetaMask connects AND we know eligibility
  useEffect(() => {
    if (ethConnected && !loadingAllocation && migrationStep === 1) {
      setMigrationStep(2);
      addDebugMessage(`Step 2: Connect Starknet wallet`);
    }
  }, [ethConnected, loadingAllocation, migrationStep]);

  // Advance to step 3 when Starknet connects AND eligible
  useEffect(() => {
    if (starknetStatus === 'connected' && isEligible && migrationStep === 2) {
      setMigrationStep(3);
      addDebugMessage(`Step 3: Ready to claim tokens`);
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
    addDebugMessage(`Requesting signature from MetaMask...`);
    signMessage({ message });
  };

  // Step 2: Connect Cartridge Controller
  const handleConnectController = useCallback(async () => {
    if (controllerConnector) {
      addDebugMessage(`Connecting Cartridge Controller...`);
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

  /**
   * Claim Transaction Handler
   * 
   * This function executes the actual claim transaction on Starknet. The transaction
   * calls the portal contract's `claim` function with the user's allocation amount
   * and merkle proof.
   * 
   * Technical Details:
   * 
   * 1. u256 Serialization: Starknet uses u256 (256-bit unsigned integer) for large
   *    numbers. We split it into two felt252 values: low (128 bits) and high (128 bits).
   *    This is required because Cairo's native type system doesn't support 256-bit
   *    integers directly.
   * 
   * 2. Calldata Preparation: We manually build calldata using hex strings with 0x prefix
   *    to match the working pattern. The claim function signature is:
   *    claim(amount: u256, proof: Span<felt252>)
   * 
   * 3. Session Key Execution: If Cartridge Controller is connected and a session is
   *    active, this transaction executes automatically without user interaction or gas
   *    fees. The session keys handle signing and submission.
   * 
   * 4. Transaction Flow:
   *    - Portal contract verifies the merkle proof against the stored root
   *    - If valid, marks the address as claimed (prevents double-claiming)
   *    - Mints tokens to the caller's Starknet address
   *    - Returns transaction hash for tracking
   */
  // Step 3: Claim tokens on Starknet
  const handleClaim = async () => {
    // Enhanced guard clause with logging
    if (!account || !claimAmount || claiming || !isEligible) {
      console.log("[CLAIM] Guard failed:", {
        account: !!account,
        claimAmount,
        claiming,
        isEligible
      })

      if (!isEligible) {
        setClaimError("You are not eligible to claim tokens. Please check your address.")
      }

      return
    }

    setClaiming(true)
    setClaimError(null)
    addDebugMessage("Starting claim transaction...")

    try {
      // Log all claim parameters
      console.log("[CLAIM] ====== STARTING CLAIM ======")
      console.log("[CLAIM] claimAmount:", claimAmount)
      console.log("[CLAIM] claimProof:", claimProof)
      console.log("[CLAIM] account.address:", account.address)
      console.log("[CLAIM] PORTAL_ADDRESS:", PORTAL_ADDRESS)

      // Convert amount to u256 (low, high) - use hex strings like working page.tsx
      const amountBigInt = BigInt(claimAmount)
      const LOW_MASK = BigInt("0xffffffffffffffffffffffffffffffff") // 128-bit mask
      const amountLow = "0x" + (amountBigInt & LOW_MASK).toString(16)
      const amountHigh = "0x" + (amountBigInt >> BigInt(128)).toString(16)

      // Proof serialization: Span<felt252> = [length, ...elements]
      const proofLength = claimProof.length.toString()

      // Build calldata manually (matches working home page pattern)
      const calldata = [amountLow, amountHigh, proofLength, ...claimProof]

      console.log("[CLAIM] Prepared calldata:", {
        amountRaw: claimAmount,
        amountBigInt: amountBigInt.toString(),
        amountLow,
        amountHigh,
        proofLength,
        proof: claimProof,
        fullCalldata: calldata,
      })

      // Prepare transaction object (single object, not array)
      const tx = {
        contractAddress: PORTAL_ADDRESS,
        entrypoint: "claim",
        calldata,
      }

      console.log("[CLAIM] Transaction object:", JSON.stringify(tx, null, 2))
      console.log("[CLAIM] Executing with account.execute()...")

      // Execute claim transaction
      const startTime = Date.now()
      const result = await account.execute(tx)
      const duration = Date.now() - startTime

      console.log("[CLAIM] ====== SUCCESS ======")
      console.log("[CLAIM] Result:", result)
      console.log("[CLAIM] Duration:", duration, "ms")

      // Validate result
      if (result?.transaction_hash) {
        setTxHash(result.transaction_hash)
        addDebugMessage(`Transaction submitted: ${result.transaction_hash.slice(0, 20)}...`)
        console.log("[CLAIM] Transaction hash:", result.transaction_hash)
      } else {
        throw new Error("No transaction hash returned from account.execute")
      }
    } catch (err: unknown) {
      // ====== COMPREHENSIVE ERROR LOGGING ======
      console.log("[CLAIM] ====== ERROR ======")
      console.log("[CLAIM] Error type:", typeof err)
      console.log("[CLAIM] Error:", err)
      
      // Log all properties of the error object
      if (err && typeof err === "object") {
        console.log("[CLAIM] Error properties:", Object.keys(err))
        console.log("[CLAIM] Full error object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
        
        // Try to extract nested error info
        const anyErr = err as any
        console.log("[CLAIM] err.message:", anyErr.message)
        console.log("[CLAIM] err.code:", anyErr.code)
        console.log("[CLAIM] err.data:", anyErr.data)
        console.log("[CLAIM] err.cause:", anyErr.cause)
        console.log("[CLAIM] err.reason:", anyErr.reason)
        console.log("[CLAIM] err.revert_reason:", anyErr.revert_reason)
        console.log("[CLAIM] err.error:", anyErr.error)
        
        // Starknet specific
        if (anyErr.response) {
          console.log("[CLAIM] err.response:", anyErr.response)
        }
        if (anyErr.transaction_failure_reason) {
          console.log("[CLAIM] err.transaction_failure_reason:", anyErr.transaction_failure_reason)
        }
      }

      // Build error message for UI
      let errorMessage = "Failed to claim tokens"

      if (err instanceof Error) {
        errorMessage = err.message || errorMessage
        
        // Parse Starknet-specific errors
        if (err.message?.includes("invalid merkle proof")) {
          errorMessage = "Invalid merkle proof. The merkle tree may need regeneration with your Starknet address."
        } else if (err.message?.includes("already claimed")) {
          errorMessage = "You have already claimed your tokens."
        } else if (err.message?.includes("claim period ended")) {
          errorMessage = "The claim period has ended."
        } else if (err.message?.includes("amount must be positive")) {
          errorMessage = "Claim amount must be greater than zero."
        } else if (err.message?.includes("Pausable: paused")) {
          errorMessage = "The contract is currently paused."
        }
      } else if (typeof err === "string") {
        errorMessage = err
      } else if (err && typeof err === "object") {
        const anyErr = err as any
        if (anyErr.message) {
          errorMessage = String(anyErr.message)
        } else if (anyErr.revert_reason) {
          errorMessage = String(anyErr.revert_reason)
        } else if (anyErr.cause?.message) {
          errorMessage = String(anyErr.cause.message)
        }
      }

      console.log("[CLAIM] Final error message:", errorMessage)
      setClaimError(errorMessage)
      addDebugMessage(`Claim error: ${errorMessage}`)
    } finally {
      setClaiming(false)
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

  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  return (
    <main className="min-h-screen bg-white text-gray-900 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold mb-2">Token Migration Portal</h1>
          <p className="text-gray-600 mb-4">
            Migrate your tokens from L1 to Starknet
          </p>
          
          {/* Technical Explanation Section */}
          <div className="text-left bg-gray-50 border border-gray-300 p-4 mb-6 max-w-3xl mx-auto">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full text-left flex items-center justify-between text-sm font-semibold text-gray-900 hover:text-gray-700 transition"
            >
              <span>Technical Overview: How This Works</span>
              <span className="text-gray-500">{showTechnicalDetails ? "−" : "+"}</span>
            </button>
            
            {showTechnicalDetails && (
              <div className="mt-4 space-y-4 text-sm text-gray-700">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Dual-Wallet Architecture</h3>
                  <p className="text-gray-700 leading-relaxed">
                    This portal uses two wallets for different purposes. Your Ethereum wallet (MetaMask) proves ownership of tokens on L1. The merkle tree snapshot uses Ethereum addresses to determine eligibility. Your Starknet wallet (Cartridge Controller) receives the migrated tokens on L2. This separation allows users to prove ownership on one chain and execute on another.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Merkle Tree Verification</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Eligibility is determined by a merkle tree—a cryptographic data structure that enables efficient proof verification. Instead of storing all eligible addresses on-chain (expensive), we store only the root hash. When you connect your Ethereum wallet, we check if your address exists in the merkle tree and fetch your allocation amount and cryptographic proof. The portal contract verifies this proof against the stored root hash before minting tokens.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Cartridge Controller: Gasless Transactions</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Cartridge Controller uses session keys—pre-authorized signing keys that enable gasless transactions. When you connect for the first time, you approve a session policy that grants permission for specific contract methods to be called automatically. These session keys are stored securely in Cartridge's keychain. After initial approval, transactions matching the policy execute automatically without popups, confirmations, or gas fees. This eliminates the friction of traditional wallet interactions.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Passkey Authentication</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Instead of managing seed phrases or private keys, Cartridge Controller uses WebAuthn passkeys. Users authenticate with biometrics (fingerprint, face ID) or hardware security keys. This provides hardware-backed security without the complexity of seed phrase management. The passkey is stored securely and can sync across devices.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Transaction Execution Flow</h3>
                  <p className="text-gray-700 leading-relaxed">
                    The claim transaction calls the portal contract's `claim` function with your amount (serialized as a u256 struct with low and high components) and merkle proof. The contract verifies the proof against the stored root hash, marks your address as claimed to prevent double-claiming, and mints tokens to your Starknet address—all in a single atomic transaction. If Cartridge Controller is connected with an active session, this executes automatically using session keys without user interaction.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Why This Architecture?</h3>
                  <p className="text-gray-700 leading-relaxed">
                    This design solves a fundamental problem: proving ownership on one chain and executing on another. The Ethereum signature proves you control the address in the snapshot. The merkle proof proves your address is eligible. The Starknet transaction executes the migration. Cartridge Controller makes the execution frictionless by eliminating gas fees and transaction confirmations after the initial session setup.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 1: Connect MetaMask & Sign */}
        <div
          className={`p-6 border ${
            migrationStep >= 1
              ? "border-gray-400 bg-gray-50"
              : "border-gray-300 bg-white"
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              migrationStep >= 1 ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-600"
            }`}>
              1
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">
                Connect L1 Wallet & Authorize
              </h2>
              <p className="text-xs text-gray-600 mt-1">
                Your Ethereum address is used to check eligibility in the merkle tree snapshot
              </p>
            </div>
          </div>

          {!ethConnected ? (
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-100 border border-gray-300 p-3">
                <p className="text-sm text-gray-600">Connected (Ethereum/L1)</p>
                <p className="font-mono text-sm break-all text-gray-900">{ethAddress}</p>
              </div>

              {loadingAllocation && (
                <div className="bg-gray-100 border border-gray-300 p-3">
                  <p className="text-gray-700 text-sm">Checking eligibility...</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Looking up your Ethereum address in the merkle tree snapshot
                  </p>
                </div>
              )}

              {!signature ? (
                <div className="space-y-3">
                  {!starknetAddress && (
                    <div className="bg-gray-100 border border-gray-300 p-3">
                      <p className="text-sm text-gray-700 font-medium mb-1">
                        Connect Starknet wallet (Step 2) before signing
                      </p>
                      <p className="text-xs text-gray-600">
                        The authorization message must include both your Ethereum and Starknet addresses to create a cryptographic link between them.
                      </p>
                    </div>
                  )}
                  <button
                    onClick={handleSignMigration}
                    disabled={isSigning || !starknetAddress || loadingAllocation}
                    className="w-full py-3 px-6 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium transition"
                  >
                    {isSigning 
                      ? "Sign in MetaMask..." 
                      : !starknetAddress
                      ? "Connect Starknet wallet first (Step 2)"
                      : loadingAllocation
                      ? "Checking eligibility..."
                      : "Sign Migration Authorization"}
                  </button>
                  {starknetAddress && !loadingAllocation && (
                    <p className="text-xs text-gray-600">
                      This signature proves you control the Ethereum address and authorizes migration to your Starknet address.
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-100 border border-gray-400 p-3">
                  <p className="text-gray-900 font-medium">
                    Migration authorized
                  </p>
                  <p className="text-xs text-gray-600 mt-1 break-all">
                    Signature: {signature.slice(0, 20)}...
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    The signature cryptographically links your Ethereum address (from the snapshot) to your Starknet address (where tokens will be minted).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Connect Cartridge Controller */}
        <div
          className={`p-6 border ${
            migrationStep >= 2
              ? "border-gray-400 bg-gray-50"
              : "border-gray-300 bg-white"
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                migrationStep >= 2 ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              2
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Connect Starknet Wallet</h2>
              <p className="text-xs text-gray-600 mt-1">
                Cartridge Controller uses session keys for gasless transactions after initial setup
              </p>
            </div>
          </div>

          {migrationStep < 2 ? (
            <p className="text-gray-500">Complete step 1 first</p>
          ) : starknetStatus !== "connected" ? (
            <div className="space-y-3">
              <button
                onClick={handleConnectController}
                className="w-full py-3 px-6 bg-gray-800 hover:bg-gray-900 text-white font-medium transition"
              >
                Connect Controller (Passkey)
              </button>
              <div className="bg-gray-100 border border-gray-300 p-3 text-xs text-gray-700">
                <p className="font-medium mb-1">What is Cartridge Controller?</p>
                <p className="text-gray-600 leading-relaxed">
                  Cartridge Controller is a smart wallet that uses WebAuthn passkeys for authentication and session keys for gasless transactions. After your first connection, you'll approve a session policy that allows automatic execution of claim transactions without popups or fees.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-100 border border-gray-300 p-3">
                <p className="text-sm text-gray-600">Connected (Starknet)</p>
                <p className="font-mono text-sm break-all text-gray-900">{starknetAddress}</p>
              </div>
              
              {loadingAllocation && (
                <div className="bg-gray-100 border border-gray-300 p-3">
                  <p className="text-gray-700 text-sm">Loading allocation data...</p>
                </div>
              )}
              
              {!loadingAllocation && isEligible && migrationStep === 2 && (
                <div className="bg-gray-100 border border-gray-400 p-3">
                  <p className="text-gray-900 text-sm font-medium">Eligible for migration</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Your Ethereum address was found in the merkle tree. The portal contract will verify your proof on-chain before minting tokens.
                  </p>
                </div>
              )}
              
              {!loadingAllocation && !isEligible && claimError && (
                <div className="bg-gray-100 border border-red-400 p-3">
                  <p className="text-red-700 text-sm font-medium">{claimError}</p>
                  <p className="text-xs text-red-600 mt-1">
                    The merkle tree snapshot determines eligibility. If your address isn't in the snapshot, you're not eligible for this migration.
                  </p>
                </div>
              )}

              {starknetStatus === "connected" && (
                <button
                  onClick={handleDisconnect}
                  className="text-gray-600 hover:text-gray-900 text-sm transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Claim Tokens */}
        <div
          className={`p-6 border ${
            migrationStep >= 3
              ? "border-gray-400 bg-gray-50"
              : "border-gray-300 bg-white"
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                migrationStep >= 3 ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              3
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Claim on Starknet</h2>
              <p className="text-xs text-gray-600 mt-1">
                Portal contract verifies merkle proof and mints tokens in one atomic transaction
              </p>
            </div>
          </div>

          {migrationStep < 3 ? (
            <p className="text-gray-500">Complete previous steps first</p>
          ) : !isEligible ? (
            <div className="space-y-4">
              <div className="bg-gray-100 border border-red-400 p-4">
                <p className="text-gray-900 font-medium">Not Eligible</p>
                <p className="text-sm text-gray-700 mt-2">
                  {claimError || "Your address is not in the migration snapshot."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-100 border border-gray-300 p-4">
                <p className="text-gray-600 mb-2">You will receive:</p>
                <p className="text-3xl font-bold text-gray-900">
                  {claimAmount && claimAmount !== "0" 
                    ? formatAmount(claimAmount)
                    : "0"} tokens
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  This amount comes from the merkle tree snapshot. The portal contract will verify your proof and mint exactly this amount to your Starknet address.
                </p>
              </div>

              {claimError && (
                <div className="bg-gray-100 border border-red-400 p-3">
                  <p className="text-red-700 text-sm">{claimError}</p>
                </div>
              )}

              {txHash && (
                <div className="bg-gray-100 border border-gray-400 p-3">
                  <p className="text-gray-900 text-sm mb-1">
                    Transaction submitted
                  </p>
                  <a
                    href={getStarkscanUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 text-xs underline break-all hover:text-gray-900"
                  >
                    View on Starkscan: {txHash.slice(0, 20)}...
                  </a>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={handleClaim}
                  disabled={claiming || !account || !!txHash || !isEligible}
                  className="w-full py-4 px-6 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 disabled:text-gray-500 text-white font-semibold text-lg transition"
                >
                  {claiming
                    ? "Claiming..."
                    : txHash
                    ? "Claimed"
                    : "Claim Tokens"}
                </button>
                {!txHash && !claiming && (
                  <p className="text-xs text-gray-600 text-center">
                    If Cartridge Controller is connected with an active session, this transaction will execute automatically without popups or gas fees.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Debug Panel */}
        <div className="bg-gray-50 border border-gray-300 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Debug Panel
              <span className="text-xs font-normal text-gray-600">
                ({debugInfo.length} messages)
              </span>
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setDebugExpanded(!debugExpanded)}
                className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 border border-gray-400 text-gray-900"
              >
                {debugExpanded ? "Collapse" : "Expand"}
              </button>
              <button 
                onClick={() => setDebugInfo([])}
                className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 border border-gray-400 text-gray-900"
              >
                Clear
              </button>
            </div>
          </div>

          {/* System State Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-white border border-gray-300">
            <div>
              <div className="text-xs text-gray-600 mb-1">ETH Status</div>
              <div className={`text-sm font-mono font-semibold ${
                ethConnected ? "text-gray-900" : "text-gray-500"
              }`}>
                {ethConnected ? "CONNECTED" : "DISCONNECTED"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Starknet Status</div>
              <div className={`text-sm font-mono font-semibold ${
                starknetStatus === "connected" ? "text-gray-900" :
                starknetStatus === "connecting" ? "text-gray-600" :
                "text-gray-500"
              }`}>
                {starknetStatus?.toUpperCase() || "DISCONNECTED"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">ETH Address</div>
              <div className="text-xs font-mono text-gray-900 break-all">
                {ethAddress || "Not connected"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Starknet Address</div>
              <div className="text-xs font-mono text-gray-900 break-all">
                {starknetAddress || "Not connected"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Signature</div>
              <div className="text-xs font-mono text-gray-900 break-all">
                {signature ? `${signature.slice(0, 20)}...` : "Not signed"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Step</div>
              <div className="text-sm font-semibold text-gray-900">
                {migrationStep}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Eligible</div>
              <div className={`text-sm font-semibold ${
                isEligible ? "text-gray-900" : "text-gray-500"
              }`}>
                {isEligible ? "YES" : "NO"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Claim Amount</div>
              <div className="text-xs font-mono text-gray-900">
                {claimAmount}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Claiming</div>
              <div className={`text-sm font-semibold ${
                claiming ? "text-gray-700" : "text-gray-500"
              }`}>
                {claiming ? "YES" : "NO"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Has Account</div>
              <div className={`text-sm font-semibold ${
                account ? "text-gray-900" : "text-gray-500"
              }`}>
                {account ? "YES" : "NO"}
              </div>
            </div>
          </div>

          {/* Contract Info */}
          <div className="mb-4 p-4 bg-white border border-gray-300">
            <div className="text-xs text-gray-600 mb-2 font-semibold">Contract Addresses</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-gray-600">Portal:</span>{" "}
                <span className="text-gray-900 break-all">{PORTAL_ADDRESS}</span>
              </div>
              <div>
                <span className="text-gray-600">Token:</span>{" "}
                <span className="text-gray-900 break-all">{TOKEN_ADDRESS}</span>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {claimError && (
            <div className="mb-4 p-4 bg-gray-100 border border-red-400">
              <div className="text-xs text-gray-900 font-semibold mb-1">Error</div>
              <div className="text-sm font-mono text-red-700 break-all">{claimError}</div>
            </div>
          )}

          {/* Transaction Hash */}
          {txHash && (
            <div className="mb-4 p-4 bg-gray-100 border border-gray-400">
              <div className="text-xs text-gray-900 font-semibold mb-1">Transaction Hash</div>
              <div className="text-sm font-mono text-gray-900 break-all">{txHash}</div>
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
              <div className="font-mono text-xs text-gray-700 max-h-96 overflow-y-auto space-y-1 p-3 bg-white border border-gray-300">
                {debugInfo.length === 0 ? (
                  <p className="text-gray-500 italic">No debug messages yet... Actions will appear here</p>
                ) : (
                  debugInfo.slice(-50).map((msg, i) => (
                    <p key={i} className={
                      msg.includes("ERROR") || msg.includes("error") ? "text-red-700" :
                      msg.includes("===") || msg.includes("warning") ? "text-gray-600" :
                      msg.includes("complete") || msg.includes("SUCCESS") ? "text-gray-900" :
                      msg.includes("CONNECT") ? "text-gray-800" :
                      msg.includes("CLAIM") ? "text-gray-800" :
                      "text-gray-700"
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
