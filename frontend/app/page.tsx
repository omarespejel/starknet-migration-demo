"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAccount as useStarknetAccount, useConnect } from "@starknet-react/core"
import { useAccount as useEthAccount, useSignMessage } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { PORTAL_ADDRESS, getStarkscanUrl } from "@/lib/constants"
import { fetchAllocation } from "@/lib/merkle"

// components for the UI

// just a box that shows some info, nothing fancy
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
    info: "bg-neutral-50 border-neutral-200 text-neutral-900",
    success: "bg-neutral-50 border-neutral-200 text-neutral-900",
    warning: "bg-neutral-50 border-neutral-200 text-neutral-900",
    code: "bg-neutral-900 border-neutral-800 text-neutral-100",
  }

  return (
    <div className={`rounded-lg border p-4 ${colors[type]}`}>
      <div>
        <h4 className="font-semibold mb-1 text-sm">{title}</h4>
        <div className="text-sm text-neutral-600">{children}</div>
      </div>
    </div>
  )
}

// step header thing, shows which step we're on
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
    <div className={`flex items-center gap-4 mb-4 ${isActive ? "opacity-100" : "opacity-40"}`}>
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
        ${isComplete ? "bg-black text-white" : isActive ? "bg-black text-white" : "bg-neutral-200 text-neutral-500"}
      `}>
        {isComplete ? "done" : step}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <p className="text-neutral-600 text-sm">{subtitle}</p>
      </div>
    </div>
  )
}

// shows live data values, pretty straightforward
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
    <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
      <div className="flex justify-between items-start mb-1">
        <span className="text-neutral-500 text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="font-mono text-sm text-neutral-900 break-all">
        {value || <span className="text-neutral-400 italic">Not available</span>}
      </div>
      <div className="text-xs text-neutral-500 mt-2">{explanation}</div>
    </div>
  )
}

// visualizes the calldata we're sending to starknet
// TODO: maybe add more details about what each field means
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
    <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-800">
      <h4 className="text-sm font-semibold text-neutral-100 mb-3">
        Transaction Calldata Structure
        <span className="text-xs font-normal text-neutral-400 ml-2">(sent to Starknet contract)</span>
      </h4>
      
      <div className="space-y-3 font-mono text-xs">
        <div className="flex items-start gap-3">
          <span className="text-neutral-400 w-24 shrink-0">amount.low:</span>
          <span className="text-neutral-100 break-all">{amountLow}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-neutral-400 w-24 shrink-0">amount.high:</span>
          <span className="text-neutral-100 break-all">{amountHigh}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-neutral-400 w-24 shrink-0">proof.length:</span>
          <span className="text-neutral-100">{proof.length}</span>
        </div>
        {proof.length > 0 && (
          <div className="flex items-start gap-3">
            <span className="text-neutral-400 w-24 shrink-0">proof[]:</span>
            <span className="text-neutral-100 break-all">[{proof.join(", ")}]</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-800">
        <p className="text-xs text-neutral-400">
          <strong className="text-neutral-300">u256 serialization:</strong> Starknet's felt252 type cannot represent full 256-bit integers. 
          Values are split into low (bits 0-127) and high (bits 128-255) components.
        </p>
      </div>
    </div>
  )
}

// shows the flow diagram, updates based on current step
function ArchitectureDiagram({ currentStep }: { currentStep: number }) {
  return (
    <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
      <h4 className="text-sm font-semibold text-neutral-900 mb-4">Migration Architecture</h4>
      
      <div className="flex items-center justify-between text-xs">
        {/* L1 Side */}
        <div className={`text-center p-3 rounded-lg border transition-all ${
          currentStep === 1 ? "border-black bg-neutral-100" : "border-neutral-300"
        }`}>
          <div className="font-semibold text-neutral-900 mb-1">MetaMask</div>
          <div className="text-neutral-600">L1 / IMX</div>
          <div className="text-neutral-500 mt-1 text-xs">Proves ownership</div>
        </div>

        {/* Arrow */}
        <div className="flex-1 flex items-center justify-center px-2">
          <div className={`h-0.5 flex-1 ${currentStep >= 2 ? "bg-black" : "bg-neutral-300"}`}></div>
          <div className={`px-2 ${currentStep >= 2 ? "text-black" : "text-neutral-300"}`}>→</div>
          <div className={`h-0.5 flex-1 ${currentStep >= 2 ? "bg-black" : "bg-neutral-300"}`}></div>
        </div>

        {/* Merkle Tree */}
        <div className={`text-center p-3 rounded-lg border transition-all ${
          currentStep === 2 ? "border-black bg-neutral-100" : "border-neutral-300"
        }`}>
          <div className="font-semibold text-neutral-900 mb-1">Merkle Tree</div>
          <div className="text-neutral-600">Off-chain</div>
          <div className="text-neutral-500 mt-1 text-xs">Verifies eligibility</div>
        </div>

        {/* Arrow */}
        <div className="flex-1 flex items-center justify-center px-2">
          <div className={`h-0.5 flex-1 ${currentStep >= 3 ? "bg-black" : "bg-neutral-300"}`}></div>
          <div className={`px-2 ${currentStep >= 3 ? "text-black" : "text-neutral-300"}`}>→</div>
          <div className={`h-0.5 flex-1 ${currentStep >= 3 ? "bg-black" : "bg-neutral-300"}`}></div>
        </div>

        {/* Cartridge */}
        <div className={`text-center p-3 rounded-lg border transition-all ${
          currentStep === 3 ? "border-black bg-neutral-100" : "border-neutral-300"
        }`}>
          <div className="font-semibold text-neutral-900 mb-1">Cartridge</div>
          <div className="text-neutral-600">Starknet</div>
          <div className="text-neutral-500 mt-1 text-xs">Executes transaction</div>
        </div>

        {/* Arrow */}
        <div className="flex-1 flex items-center justify-center px-2">
          <div className={`h-0.5 flex-1 ${currentStep >= 4 ? "bg-black" : "bg-neutral-300"}`}></div>
          <div className={`px-2 ${currentStep >= 4 ? "text-black" : "text-neutral-300"}`}>→</div>
          <div className={`h-0.5 flex-1 ${currentStep >= 4 ? "bg-black" : "bg-neutral-300"}`}></div>
        </div>

        {/* Token */}
        <div className={`text-center p-3 rounded-lg border transition-all ${
          currentStep === 4 ? "border-black bg-neutral-100" : "border-neutral-300"
        }`}>
          <div className="font-semibold text-neutral-900 mb-1">Tokens</div>
          <div className="text-neutral-600">On Starknet</div>
          <div className="text-neutral-500 mt-1 text-xs">Minted to address</div>
        </div>
      </div>
    </div>
  )
}

// shows what cartridge controller can do
function CartridgeFeatures({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
      <h4 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
        Cartridge Controller
        {isConnected && <span className="text-xs bg-black text-white px-2 py-0.5 rounded">Connected</span>}
      </h4>
      
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-white rounded p-2 border border-neutral-200">
          <div className="font-semibold text-neutral-900 mb-1">Gasless Transactions</div>
          <div className="text-neutral-600">No ETH/STRK required</div>
        </div>
        <div className="bg-white rounded p-2 border border-neutral-200">
          <div className="font-semibold text-neutral-900 mb-1">Passkey Authentication</div>
          <div className="text-neutral-600">WebAuthn-based</div>
        </div>
        <div className="bg-white rounded p-2 border border-neutral-200">
          <div className="font-semibold text-neutral-900 mb-1">Session Keys</div>
          <div className="text-neutral-600">Pre-authorized calls</div>
        </div>
      </div>
    </div>
  )
}

// main component, handles the whole migration flow

export default function Home() {
  // wallet stuff
  const { address: ethAddress, isConnected: ethConnected } = useEthAccount()
  const { address: starknetAddress, account, status: starknetStatus } = useStarknetAccount()
  const { connect, connectors } = useConnect()
  const { signMessage, isPending: isSigning, data: signature } = useSignMessage()

  // state for the migration flow
  const [migrationStep, setMigrationStep] = useState(1)
  const [isEligible, setIsEligible] = useState<boolean | null>(null)
  const [claimAmount, setClaimAmount] = useState<string | null>(null)
  const [claimProof, setClaimProof] = useState<string[]>([])
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [loadingAllocation, setLoadingAllocation] = useState(false)

  // find the cartridge connector
  const controllerConnector = connectors.find((c) => c.id === "controller")

  // check if user is eligible when they connect their eth wallet
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

  // move to next step when conditions are met
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

  // sign the auth message with metamask
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

  // actually claim the tokens on starknet
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

  // convert wei to tokens for display
  const formatAmount = (amount: string | null) => {
    if (!amount) return "0"
    return (BigInt(amount) / BigInt(10 ** 18)).toString()
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      {/* Header */}
      <div className="border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
          <h1 className="text-3xl font-semibold mb-2">Token Migration Portal</h1>
              <p className="text-neutral-600">
                L1 to Starknet migration implementation with Cartridge Controller
              </p>
            </div>
            <a 
              href="https://github.com/omarespejel/starknet-migration-demo" 
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black hover:bg-neutral-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              View Source Code
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
            <div className={`bg-white rounded-lg p-6 border ${
              migrationStep === 1 ? "border-black" : migrationStep > 1 ? "border-neutral-300" : "border-neutral-200"
            }`}>
              <StepHeader 
                step={1} 
                title="Connect L1 Wallet" 
                subtitle="Verify eligibility via merkle tree snapshot"
                isActive={migrationStep >= 1}
                isComplete={migrationStep > 1}
              />
              
              <InfoBox title="Purpose" type="info">
                The merkle tree snapshot contains L1 (Ethereum/IMX) addresses. 
                Connecting MetaMask authenticates ownership of an address in the snapshot.
              </InfoBox>

              <div className="mt-4">
          {!ethConnected ? (
              <ConnectButton />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-neutral-900">
                      <span className="text-neutral-600">Connected:</span>
                      <span className="font-mono text-sm">{ethAddress?.slice(0, 10)}...{ethAddress?.slice(-8)}</span>
              </div>

              {loadingAllocation && (
                      <div className="text-neutral-600 text-sm">Checking eligibility...</div>
                    )}
                    
                    {isEligible === true && (
                      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                        <div className="text-neutral-900 font-semibold">Eligible: {formatAmount(claimAmount)} tokens</div>
                        <div className="text-xs text-neutral-600 mt-1">Address found in merkle tree snapshot.</div>
                </div>
              )}

                    {isEligible === false && (
                      <div className="bg-neutral-50 border border-neutral-300 rounded-lg p-3">
                        <div className="text-neutral-900">Address not in snapshot</div>
                        <div className="text-xs text-neutral-600 mt-1">This ETH address is not eligible for migration.</div>
                </div>
              )}
            </div>
          )}
        </div>
            </div>

            {/* Step 2: Connect Starknet & Sign */}
            <div className={`bg-white rounded-lg p-6 border ${
              migrationStep === 2 ? "border-black" : migrationStep > 2 ? "border-neutral-300" : "border-neutral-200"
            }`}>
              <StepHeader 
                step={2} 
                title="Connect Starknet Wallet & Authorize" 
                subtitle="Connect Cartridge Controller and sign authorization message"
                isActive={migrationStep >= 2}
                isComplete={migrationStep > 2}
              />
              
              <InfoBox title="Cartridge Controller" type="info">
                Cartridge Controller enables gasless transactions via session keys. 
                The session policy pre-authorizes the claim function, eliminating the need for STRK/ETH.
              </InfoBox>

              <CartridgeFeatures isConnected={starknetStatus === "connected"} />

              <div className="mt-4 space-y-4">
                {starknetStatus !== "connected" ? (
              <button
                    onClick={() => controllerConnector && connect({ connector: controllerConnector })}
                    disabled={migrationStep < 2}
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${
                      migrationStep >= 2 
                        ? "bg-black hover:bg-neutral-800 text-white" 
                        : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                    }`}
                  >
                    Connect Cartridge Controller
              </button>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-neutral-900">
                      <span className="text-neutral-600">Starknet:</span>
                      <span className="font-mono text-sm">{starknetAddress?.slice(0, 10)}...{starknetAddress?.slice(-8)}</span>
              </div>
              
                    {!signature ? (
                <button
                        onClick={handleSign}
                        disabled={isSigning}
                        className="w-full py-3 bg-black hover:bg-neutral-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                        {isSigning ? "Signing..." : "Sign Migration Authorization"}
                </button>
                    ) : (
                      <div className="flex items-center gap-2 text-neutral-900">
                        <span className="text-neutral-600">Authorization signed</span>
            </div>
          )}
                  </>
                )}
              </div>
            </div>

            {/* Step 3: Claim */}
            <div className={`bg-white rounded-lg p-6 border ${
              migrationStep === 3 ? "border-black" : migrationStep > 3 ? "border-neutral-300" : "border-neutral-200"
            }`}>
              <StepHeader 
                step={3} 
                title="Claim Tokens" 
                subtitle="Execute claim transaction on Starknet"
                isActive={migrationStep >= 3}
                isComplete={migrationStep > 3}
              />
              
              <InfoBox title="On-chain execution" type="code">
                The Portal contract: 1) Verifies merkle proof against stored root, 2) Marks address as claimed, 
                3) Mints tokens to Starknet address. Executed atomically in a single transaction.
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
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    <div className="text-neutral-900 font-semibold mb-2">Transaction submitted</div>
                  <a
                    href={getStarkscanUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                      className="text-neutral-600 hover:text-black text-sm underline"
                  >
                      View on Starkscan
                  </a>
                </div>
                ) : (
                  <>
                <button
                  onClick={handleClaim}
                      disabled={migrationStep < 3 || claiming}
                      className={`w-full py-3 rounded-lg font-medium transition-colors ${
                        migrationStep >= 3 && !claiming
                          ? "bg-black hover:bg-neutral-800 text-white" 
                          : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      }`}
                    >
                      {claiming ? "Claiming..." : `Claim ${formatAmount(claimAmount)} Tokens`}
                </button>
                    
                    {claimError && (
                      <div className="mt-3 bg-neutral-50 border border-neutral-300 rounded-lg p-3 text-neutral-900 text-sm">
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
            <div className="bg-white rounded-lg p-6 border border-neutral-200">
              <h3 className="text-lg font-semibold mb-4 text-neutral-900">
                Live Data
                <span className="w-2 h-2 bg-black rounded-full inline-block ml-2"></span>
              </h3>
              
              <div className="space-y-4">
                <LiveDataDisplay 
                  label="L1 Address"
                  value={ethAddress || null}
                  explanation="MetaMask address used for merkle tree lookup"
                />
                <LiveDataDisplay 
                  label="Starknet Address"
                  value={starknetAddress || null}
                  explanation="Cartridge Controller address receiving minted tokens"
                />
                <LiveDataDisplay 
                  label="Claim Amount (wei)"
                  value={claimAmount}
                  explanation="Raw amount in wei (10^18 wei = 1 token)"
                />
                <LiveDataDisplay 
                  label="Proof Length"
                  value={claimProof.length.toString()}
                  explanation="Number of merkle proof elements (0 indicates single-leaf tree)"
                />
                <LiveDataDisplay 
                  label="Signature"
                  value={signature ? `${signature.slice(0, 20)}...` : null}
                  explanation="EIP-191 signature authorizing migration"
                />
                <LiveDataDisplay 
                  label="Transaction Hash"
                  value={txHash ? `${txHash.slice(0, 20)}...` : null}
                  explanation="Starknet transaction identifier"
                />
              </div>
            </div>

            {/* Key Concepts */}
            <div className="bg-white rounded-lg p-6 border border-neutral-200">
              <h3 className="text-lg font-semibold mb-4 text-neutral-900">Key Concepts</h3>
              
              <div className="space-y-4 text-sm">
            <div>
                  <h4 className="font-semibold text-neutral-900 mb-1">Merkle Tree</h4>
                  <p className="text-neutral-600">
                    Cryptographic hash tree storing eligible addresses. Only the root hash is stored on-chain. 
                    Merkle proofs verify membership without revealing all addresses.
                  </p>
              </div>
                
            <div>
                  <h4 className="font-semibold text-neutral-900 mb-1">Session Keys</h4>
                  <p className="text-neutral-600">
                    Temporary signing keys that pre-approve specific contract method calls. 
                    Enables gasless user experience without compromising security.
                  </p>
              </div>
                
            <div>
                  <h4 className="font-semibold text-neutral-900 mb-1">Dual Wallet Architecture</h4>
                  <p className="text-neutral-600">
                    L1 wallet authenticates token ownership, Starknet wallet receives tokens. 
                    EIP-191 signature cryptographically links both addresses.
                  </p>
              </div>
            </div>
          </div>

            {/* Documentation Link */}
            <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
              <h3 className="text-lg font-semibold mb-2 text-neutral-900">Documentation</h3>
              <p className="text-neutral-600 text-sm mb-4">
                Cartridge Controller integration guide and API reference.
              </p>
              <a 
                href="https://docs.cartridge.gg" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-black hover:bg-neutral-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                View Cartridge Docs
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
