"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAccount as useStarknetAccount, useConnect } from "@starknet-react/core"
import { useAccount as useEthAccount, useSignMessage } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { PORTAL_ADDRESS, getStarkscanUrl } from "@/lib/constants"
import { fetchAllocation } from "@/lib/merkle"

// ==================== EDUCATIONAL COMPONENTS ====================

/**
 * Info box that explains a concept
 */
function InfoBox({ 
  title, 
  children, 
  type = "info" 
}: { 
  title: string
  children: React.ReactNode
  type?: "info" | "success" | "warning" | "code"
}) {
  const colors = {
    info: "bg-blue-900/30 border-blue-500/50 text-blue-200",
    success: "bg-green-900/30 border-green-500/50 text-green-200",
    warning: "bg-yellow-900/30 border-yellow-500/50 text-yellow-200",
    code: "bg-gray-900/50 border-gray-500/50 text-gray-200",
  }

  return (
    <div className={`rounded-lg border p-4 ${colors[type]}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg">
          {type === "info" && "💡"}
          {type === "success" && "✅"}
          {type === "warning" && "⚠️"}
          {type === "code" && "🔧"}
        </span>
        <div>
          <h4 className="font-semibold mb-1">{title}</h4>
          <div className="text-sm opacity-90">{children}</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Code block with syntax highlighting feel
 */
function CodeBlock({ 
  title, 
  children,
  language = "typescript"
}: { 
  title: string
  children: string
  language?: string
}) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-700">
      <div className="bg-gray-800 px-4 py-2 text-xs text-gray-400 flex justify-between items-center">
        <span>{title}</span>
        <span className="bg-gray-700 px-2 py-0.5 rounded">{language}</span>
      </div>
      <pre className="bg-gray-900 p-4 text-sm overflow-x-auto">
        <code className="text-green-400">{children}</code>
      </pre>
    </div>
  )
}

/**
 * Step indicator with educational context
 */
function StepHeader({ 
  step, 
  title, 
  subtitle,
  isActive,
  isComplete
}: { 
  step: number
  title: string
  subtitle: string
  isActive: boolean
  isComplete: boolean
}) {
  return (
    <div className={`flex items-center gap-4 mb-4 ${isActive ? "opacity-100" : "opacity-50"}`}>
      <div className={`
        w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold
        ${isComplete ? "bg-green-600" : isActive ? "bg-blue-600" : "bg-gray-700"}
      `}>
        {isComplete ? "✓" : step}
      </div>
      <div>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-gray-400 text-sm">{subtitle}</p>
      </div>
    </div>
  )
}

/**
 * Live data display showing what's happening
 */
function LiveDataDisplay({ 
  label, 
  value, 
  explanation 
}: { 
  label: string
  value: string | null
  explanation: string
}) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
      <div className="flex justify-between items-start mb-1">
        <span className="text-gray-400 text-xs uppercase tracking-wider">{label}</span>
        <span className="text-gray-500 text-xs">ℹ️</span>
      </div>
      <div className="font-mono text-sm text-white break-all">
        {value || <span className="text-gray-500 italic">Not yet available</span>}
      </div>
      <div className="text-xs text-gray-500 mt-2">{explanation}</div>
    </div>
  )
}

/**
 * Transaction calldata visualizer
 */
function CalldataVisualizer({ 
  amount, 
  proof,
  starknetAddress
}: { 
  amount: string | null
  proof: string[]
  starknetAddress: string | null
}) {
  if (!amount) return null

  const amountBigInt = BigInt(amount)
  const LOW_MASK = BigInt("0xffffffffffffffffffffffffffffffff")
  const amountLow = "0x" + (amountBigInt & LOW_MASK).toString(16)
  const amountHigh = "0x" + (amountBigInt >> BigInt(128)).toString(16)

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        📦 Transaction Calldata Structure
        <span className="text-xs font-normal text-gray-500">(What gets sent to Starknet)</span>
      </h4>
      
      <div className="space-y-3 font-mono text-xs">
        <div className="flex items-start gap-3">
          <span className="text-blue-400 w-24 shrink-0">amount.low:</span>
          <span className="text-green-400 break-all">{amountLow}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-blue-400 w-24 shrink-0">amount.high:</span>
          <span className="text-green-400 break-all">{amountHigh}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-blue-400 w-24 shrink-0">proof.length:</span>
          <span className="text-green-400">{proof.length}</span>
        </div>
        {proof.length > 0 && (
          <div className="flex items-start gap-3">
            <span className="text-blue-400 w-24 shrink-0">proof[]:</span>
            <span className="text-green-400 break-all">[{proof.join(", ")}]</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          💡 <strong>Why u256 split?</strong> Starknet's felt252 can't hold full u256. 
          We split into low (bits 0-127) and high (bits 128-255).
        </p>
      </div>
    </div>
  )
}

/**
 * Architecture diagram showing the flow
 */
function ArchitectureDiagram({ currentStep }: { currentStep: number }) {
  return (
    <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700">
      <h4 className="text-sm font-semibold text-gray-300 mb-4">🏗️ Migration Architecture</h4>
      
      <div className="flex items-center justify-between text-xs">
        {/* L1 Side */}
        <div className={`text-center p-3 rounded-lg border-2 transition-all ${
          currentStep === 1 ? "border-blue-500 bg-blue-500/10" : "border-gray-600"
        }`}>
          <div className="text-2xl mb-1">🦊</div>
          <div className="font-semibold">MetaMask</div>
          <div className="text-gray-500">L1 / IMX</div>
          <div className="text-gray-400 mt-1">Proves ownership</div>
        </div>

        {/* Arrow */}
        <div className="flex-1 flex items-center justify-center px-2">
          <div className={`h-0.5 flex-1 ${currentStep >= 2 ? "bg-green-500" : "bg-gray-600"}`}></div>
          <div className={`px-2 ${currentStep >= 2 ? "text-green-500" : "text-gray-600"}`}>→</div>
          <div className={`h-0.5 flex-1 ${currentStep >= 2 ? "bg-green-500" : "bg-gray-600"}`}></div>
        </div>

        {/* Merkle Tree */}
        <div className={`text-center p-3 rounded-lg border-2 transition-all ${
          currentStep === 2 ? "border-blue-500 bg-blue-500/10" : "border-gray-600"
        }`}>
          <div className="text-2xl mb-1">🌳</div>
          <div className="font-semibold">Merkle Tree</div>
          <div className="text-gray-500">Off-chain</div>
          <div className="text-gray-400 mt-1">Verifies eligibility</div>
        </div>

        {/* Arrow */}
        <div className="flex-1 flex items-center justify-center px-2">
          <div className={`h-0.5 flex-1 ${currentStep >= 3 ? "bg-green-500" : "bg-gray-600"}`}></div>
          <div className={`px-2 ${currentStep >= 3 ? "text-green-500" : "text-gray-600"}`}>→</div>
          <div className={`h-0.5 flex-1 ${currentStep >= 3 ? "bg-green-500" : "bg-gray-600"}`}></div>
        </div>

        {/* Cartridge */}
        <div className={`text-center p-3 rounded-lg border-2 transition-all ${
          currentStep === 3 ? "border-blue-500 bg-blue-500/10" : "border-gray-600"
        }`}>
          <div className="text-2xl mb-1">🎮</div>
          <div className="font-semibold">Cartridge</div>
          <div className="text-gray-500">Starknet</div>
          <div className="text-gray-400 mt-1">Executes gasless</div>
        </div>

        {/* Arrow */}
        <div className="flex-1 flex items-center justify-center px-2">
          <div className={`h-0.5 flex-1 ${currentStep >= 4 ? "bg-green-500" : "bg-gray-600"}`}></div>
          <div className={`px-2 ${currentStep >= 4 ? "text-green-500" : "text-gray-600"}`}>→</div>
          <div className={`h-0.5 flex-1 ${currentStep >= 4 ? "bg-green-500" : "bg-gray-600"}`}></div>
        </div>

        {/* Token */}
        <div className={`text-center p-3 rounded-lg border-2 transition-all ${
          currentStep === 4 ? "border-green-500 bg-green-500/10" : "border-gray-600"
        }`}>
          <div className="text-2xl mb-1">🪙</div>
          <div className="font-semibold">Tokens</div>
          <div className="text-gray-500">On Starknet</div>
          <div className="text-gray-400 mt-1">Minted to user</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Cartridge feature highlight
 */
function CartridgeFeatures({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg p-4 border border-purple-500/30">
      <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
        🎮 Cartridge Controller Features
        {isConnected && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Active</span>}
      </h4>
      
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-black/20 rounded p-2">
          <div className="text-lg mb-1">⛽</div>
          <div className="font-semibold text-white">Gasless TX</div>
          <div className="text-gray-400">No ETH/STRK needed</div>
        </div>
        <div className="bg-black/20 rounded p-2">
          <div className="text-lg mb-1">🔐</div>
          <div className="font-semibold text-white">Passkey Auth</div>
          <div className="text-gray-400">No seed phrase</div>
        </div>
        <div className="bg-black/20 rounded p-2">
          <div className="text-lg mb-1">🔑</div>
          <div className="font-semibold text-white">Session Keys</div>
          <div className="text-gray-400">Pre-approved TXs</div>
        </div>
      </div>
    </div>
  )
}

// ==================== MAIN PAGE COMPONENT ====================

export default function Home() {
  // Wallet states
  const { address: ethAddress, isConnected: ethConnected } = useEthAccount()
  const { address: starknetAddress, account, status: starknetStatus } = useStarknetAccount()
  const { connect, connectors } = useConnect()
  const { signMessage, isPending: isSigning, data: signature } = useSignMessage()

  // Migration states
  const [migrationStep, setMigrationStep] = useState(1)
  const [isEligible, setIsEligible] = useState<boolean | null>(null)
  const [claimAmount, setClaimAmount] = useState<string | null>(null)
  const [claimProof, setClaimProof] = useState<string[]>([])
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [loadingAllocation, setLoadingAllocation] = useState(false)

  // Find Cartridge Controller connector
  const controllerConnector = connectors.find((c) => c.id === "controller")

  // Check eligibility when ETH wallet connects
  useEffect(() => {
    if (!ethAddress) {
      setIsEligible(null)
      setClaimAmount(null)
      return
    }

    const checkEligibility = async () => {
      setLoadingAllocation(true)
      try {
        const allocation = await fetchAllocation(ethAddress, starknetAddress || "")
        if (allocation) {
          setIsEligible(true)
          setClaimAmount(allocation.amount)
          setClaimProof(allocation.proof)
        } else {
          setIsEligible(false)
        }
      } catch (error) {
        console.error("Error checking eligibility:", error)
        setIsEligible(false)
      } finally {
        setLoadingAllocation(false)
      }
    }

    checkEligibility()
  }, [ethAddress, starknetAddress])

  // Progress through steps
  useEffect(() => {
    if (ethConnected && isEligible && migrationStep === 1) {
      setMigrationStep(2)
    }
  }, [ethConnected, isEligible, migrationStep])

  useEffect(() => {
    if (starknetStatus === "connected" && signature && migrationStep === 2) {
      setMigrationStep(3)
    }
  }, [starknetStatus, signature, migrationStep])

  useEffect(() => {
    if (txHash && migrationStep === 3) {
      setMigrationStep(4)
    }
  }, [txHash, migrationStep])

  // Sign authorization message
  const handleSign = () => {
    if (!ethAddress || !starknetAddress) return
    
    const message = `GG Token Migration Authorization

I authorize the migration of my tokens from L1 to Starknet.

L1 Address: ${ethAddress}
Starknet Address: ${starknetAddress}
Timestamp: ${Date.now()}

This signature proves ownership and authorizes the claim.`

    signMessage({ message })
  }

  // Claim tokens
  const handleClaim = async () => {
    if (!account || !claimAmount || claiming) return

    setClaiming(true)
    setClaimError(null)

    try {
      console.log("[CLAIM] Starting...")
      
      // Prepare calldata
      const amountBigInt = BigInt(claimAmount)
      const LOW_MASK = BigInt("0xffffffffffffffffffffffffffffffff")
      const amountLow = "0x" + (amountBigInt & LOW_MASK).toString(16)
      const amountHigh = "0x" + (amountBigInt >> BigInt(128)).toString(16)
      const proofLength = claimProof.length.toString()
      const calldata = [amountLow, amountHigh, proofLength, ...claimProof]

      console.log("[CLAIM] Calldata:", calldata)

      // Execute transaction
      const tx = {
        contractAddress: PORTAL_ADDRESS,
        entrypoint: "claim",
        calldata,
      }

      let result: any
      try {
        result = await account.execute(tx)
      } catch (e) {
        if (e === undefined || e === null) {
          throw new Error("Session expired. Please disconnect and reconnect Cartridge.")
        }
        throw e
      }

      if (result?.transaction_hash) {
        setTxHash(result.transaction_hash)
        console.log("[CLAIM] Success:", result.transaction_hash)
      } else {
        throw new Error("No transaction hash returned")
      }
    } catch (err: any) {
      console.error("[CLAIM] Error:", err)
      const msg = err?.message || "Failed to claim tokens"
      setClaimError(msg)
    } finally {
      setClaiming(false)
    }
  }

  // Format amount for display
  const formatAmount = (amount: string | null) => {
    if (!amount) return "0"
    return (BigInt(amount) / BigInt(10 ** 18)).toString()
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">🚀 Token Migration Demo</h1>
              <p className="text-gray-400">
                Learn how to build L1 → Starknet migrations with Cartridge Controller
              </p>
            </div>
            <a 
              href="https://github.com/omarespejel/starknet-migration-demo" 
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2"
            >
              📁 View Source Code
            </a>
                </div>
                </div>
                </div>
                
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Architecture Overview */}
        <div className="mb-8">
          <ArchitectureDiagram currentStep={migrationStep} />
                </div>
                
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Steps */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Step 1: Connect L1 Wallet */}
            <div className={`bg-gray-900 rounded-xl p-6 border ${
              migrationStep === 1 ? "border-blue-500" : migrationStep > 1 ? "border-green-500/30" : "border-gray-800"
            }`}>
              <StepHeader 
                step={1} 
                title="Connect L1 Wallet" 
                subtitle="Prove ownership of your L1/IMX tokens"
                isActive={migrationStep >= 1}
                isComplete={migrationStep > 1}
              />
              
              <InfoBox title="Why this step?" type="info">
                The merkle tree snapshot contains L1 (Ethereum/IMX) addresses. 
                Connecting MetaMask proves you own an address in the snapshot.
              </InfoBox>

              <div className="mt-4">
          {!ethConnected ? (
              <ConnectButton />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400">
                      <span>✓</span>
                      <span>Connected: {ethAddress?.slice(0, 10)}...{ethAddress?.slice(-8)}</span>
              </div>

              {loadingAllocation && (
                      <div className="text-yellow-400 text-sm">⏳ Checking eligibility...</div>
                    )}
                    
                    {isEligible === true && (
                      <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3">
                        <div className="text-green-400 font-semibold">✓ Eligible for {formatAmount(claimAmount)} tokens!</div>
                        <div className="text-xs text-gray-400 mt-1">Your address was found in the merkle tree snapshot.</div>
                </div>
              )}

                    {isEligible === false && (
                      <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3">
                        <div className="text-red-400">✗ Address not in snapshot</div>
                        <div className="text-xs text-gray-400 mt-1">This ETH address is not eligible for the migration.</div>
                </div>
              )}
            </div>
          )}
        </div>
            </div>

            {/* Step 2: Connect Starknet & Sign */}
            <div className={`bg-gray-900 rounded-xl p-6 border ${
              migrationStep === 2 ? "border-blue-500" : migrationStep > 2 ? "border-green-500/30" : "border-gray-800"
            }`}>
              <StepHeader 
                step={2} 
                title="Connect Starknet & Authorize" 
                subtitle="Choose destination wallet and sign authorization"
                isActive={migrationStep >= 2}
                isComplete={migrationStep > 2}
              />
              
              <InfoBox title="Why Cartridge Controller?" type="info">
                Cartridge provides <strong>gasless transactions</strong> via session keys. 
                Users don't need STRK/ETH to claim - the session policy pre-authorizes the claim function.
              </InfoBox>

              <CartridgeFeatures isConnected={starknetStatus === "connected"} />

              <div className="mt-4 space-y-4">
                {starknetStatus !== "connected" ? (
              <button
                    onClick={() => controllerConnector && connect({ connector: controllerConnector })}
                    disabled={migrationStep < 2}
                    className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                      migrationStep >= 2 
                        ? "bg-purple-600 hover:bg-purple-700" 
                        : "bg-gray-700 cursor-not-allowed"
                    }`}
                  >
                    🎮 Connect Cartridge Controller
              </button>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-green-400">
                      <span>✓</span>
                      <span>Starknet: {starknetAddress?.slice(0, 10)}...{starknetAddress?.slice(-8)}</span>
              </div>
              
                    {!signature ? (
                <button
                        onClick={handleSign}
                        disabled={isSigning}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
                >
                        {isSigning ? "⏳ Sign in MetaMask..." : "✍️ Sign Migration Authorization"}
                </button>
                    ) : (
                      <div className="flex items-center gap-2 text-green-400">
                        <span>✓</span>
                        <span>Authorization signed</span>
            </div>
          )}
                  </>
                )}
              </div>
            </div>

            {/* Step 3: Claim */}
            <div className={`bg-gray-900 rounded-xl p-6 border ${
              migrationStep === 3 ? "border-blue-500" : migrationStep > 3 ? "border-green-500/30" : "border-gray-800"
            }`}>
              <StepHeader 
                step={3} 
                title="Claim Tokens" 
                subtitle="Execute the gasless claim transaction"
                isActive={migrationStep >= 3}
                isComplete={migrationStep > 3}
              />
              
              <InfoBox title="What happens on-chain?" type="code">
                The Portal contract: 1) Verifies your merkle proof, 2) Marks your address as claimed, 
                3) Mints tokens to your Starknet address. All in one atomic transaction!
              </InfoBox>

              {claimAmount && (
                <CalldataVisualizer 
                  amount={claimAmount} 
                  proof={claimProof}
                  starknetAddress={starknetAddress || null}
                />
              )}

              <div className="mt-4">
                {txHash ? (
                  <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4">
                    <div className="text-green-400 font-semibold mb-2">🎉 Tokens Claimed Successfully!</div>
                  <a
                    href={getStarkscanUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm underline"
                  >
                      View transaction on Starkscan →
                  </a>
                </div>
                ) : (
                  <>
                <button
                  onClick={handleClaim}
                      disabled={migrationStep < 3 || claiming}
                      className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                        migrationStep >= 3 && !claiming
                          ? "bg-green-600 hover:bg-green-700" 
                          : "bg-gray-700 cursor-not-allowed"
                      }`}
                    >
                      {claiming ? "⏳ Claiming..." : `🪙 Claim ${formatAmount(claimAmount)} Tokens (Gasless)`}
                </button>
                    
                    {claimError && (
                      <div className="mt-3 bg-red-900/30 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                        {claimError}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Live Data & Education */}
          <div className="space-y-6">
            
            {/* Live Data Panel */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                📊 Live Data
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </h3>
              
              <div className="space-y-4">
                <LiveDataDisplay 
                  label="L1 Address"
                  value={ethAddress || null}
                  explanation="From MetaMask - used for merkle tree lookup"
                />
                <LiveDataDisplay 
                  label="Starknet Address"
                  value={starknetAddress || null}
                  explanation="From Cartridge - receives the minted tokens"
                />
                <LiveDataDisplay 
                  label="Claim Amount (raw)"
                  value={claimAmount}
                  explanation="In wei (10^18) - divide by 10^18 for tokens"
                />
                <LiveDataDisplay 
                  label="Proof Length"
                  value={claimProof.length.toString()}
                  explanation="Merkle proof elements (0 = single-leaf tree)"
                />
                <LiveDataDisplay 
                  label="Signature"
                  value={signature ? `${signature.slice(0, 20)}...` : null}
                  explanation="MetaMask signature authorizing migration"
                />
                <LiveDataDisplay 
                  label="Transaction Hash"
                  value={txHash ? `${txHash.slice(0, 20)}...` : null}
                  explanation="Starknet transaction ID after claiming"
                />
              </div>
            </div>

            {/* Key Concepts */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h3 className="text-lg font-semibold mb-4">📚 Key Concepts</h3>
              
              <div className="space-y-4 text-sm">
            <div>
                  <h4 className="font-semibold text-blue-400">Merkle Tree</h4>
                  <p className="text-gray-400">
                    A hash tree storing eligible addresses. Only the root is on-chain - 
                    proofs verify membership without revealing all addresses.
                  </p>
              </div>
                
            <div>
                  <h4 className="font-semibold text-purple-400">Session Keys</h4>
                  <p className="text-gray-400">
                    Temporary signing keys that pre-approve specific contract calls. 
                    Enables gasless UX without compromising security.
                  </p>
              </div>
                
            <div>
                  <h4 className="font-semibold text-green-400">Dual Wallet</h4>
                  <p className="text-gray-400">
                    L1 wallet proves token ownership, Starknet wallet receives tokens. 
                    Signature links both addresses together.
                  </p>
              </div>
            </div>
          </div>

            {/* Integration Guide Link */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-6 border border-blue-500/30">
              <h3 className="text-lg font-semibold mb-2">🛠️ Build Your Own</h3>
              <p className="text-gray-400 text-sm mb-4">
                Ready to integrate Cartridge Controller into your project?
              </p>
              <a 
                href="https://docs.cartridge.gg" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                View Cartridge Docs →
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
