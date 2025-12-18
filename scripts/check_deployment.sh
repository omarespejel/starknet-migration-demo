#!/bin/bash

# Quick deployment verification script
# Checks if contracts are deployed and configured correctly

set -e

NETWORK="${NETWORK:-sepolia}"
TOKEN_ADDRESS="${TOKEN_ADDRESS:-}"
PORTAL_ADDRESS="${PORTAL_ADDRESS:-}"

if [ -z "$TOKEN_ADDRESS" ] || [ -z "$PORTAL_ADDRESS" ]; then
  echo "❌ Error: TOKEN_ADDRESS and PORTAL_ADDRESS must be set"
  echo "Usage: TOKEN_ADDRESS=0x... PORTAL_ADDRESS=0x... ./check_deployment.sh"
  exit 1
fi

echo "🔍 Checking deployment on $NETWORK..."
echo ""

# Check token contract
echo "📦 Token Contract ($TOKEN_ADDRESS):"
TOKEN_NAME=$(sncast call --contract-address $TOKEN_ADDRESS \
  --function name \
  --network $NETWORK --json 2>/dev/null | jq -r '.result[0]' || echo "Failed")
TOKEN_SYMBOL=$(sncast call --contract-address $TOKEN_ADDRESS \
  --function symbol \
  --network $NETWORK --json 2>/dev/null | jq -r '.result[0]' || echo "Failed")
echo "  Name: $TOKEN_NAME"
echo "  Symbol: $TOKEN_SYMBOL"
echo ""

# Check portal contract
echo "🚪 Portal Contract ($PORTAL_ADDRESS):"
PORTAL_ROOT=$(sncast call --contract-address $PORTAL_ADDRESS \
  --function merkle_root \
  --network $NETWORK --json 2>/dev/null | jq -r '.result[0]' || echo "Failed")
PORTAL_TOTAL=$(sncast call --contract-address $PORTAL_ADDRESS \
  --function total_claimed \
  --network $NETWORK --json 2>/dev/null | jq -r '.result[0]' || echo "Failed")
echo "  Merkle Root: $PORTAL_ROOT"
echo "  Total Claimed: $PORTAL_TOTAL"
echo ""

# Check if portal has minter role
echo "🔐 Checking minter role..."
MINTER_ROLE=$(sncast call --contract-address $TOKEN_ADDRESS \
  --function has_role \
  --calldata $(cast --to-uint256 $(cast --to-hex $(echo -n "MINTER_ROLE" | xxd -p -c 256) | head -c 64)) $PORTAL_ADDRESS \
  --network $NETWORK --json 2>/dev/null | jq -r '.result[0]' || echo "false")
echo "  Portal has minter role: $MINTER_ROLE"
echo ""

if [ "$MINTER_ROLE" = "true" ]; then
  echo "✅ Deployment looks good!"
else
  echo "⚠️  Warning: Portal does not have minter role"
  echo "   Run: sncast invoke --contract-address $TOKEN_ADDRESS --function grant_minter_role --calldata $PORTAL_ADDRESS --network $NETWORK"
fi

