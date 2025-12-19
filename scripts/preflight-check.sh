#!/bin/bash

# Pre-browser validation script

echo "=== Pre-Browser Validation ==="

# 1. Check Node version
echo -e "\n1. Node version:"
node -v

# 2. Check packages installed correctly
echo -e "\n2. Package versions:"
cd frontend
npm ls @cartridge/controller @cartridge/connector @starknet-react/core starknet 2>/dev/null | head -10

# 3. Build check
echo -e "\n3. Build test:"
npm run build 2>&1 | tail -5

# 4. Contract connectivity
echo -e "\n4. Contract check (calling merkle_root):"
curl -s -X POST https://api.cartridge.gg/x/starknet/sepolia \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"starknet_call","params":{"request":{"contract_address":"0x027d9db485a394d3aea0c3af6a82b889cb95a833cc4fe36ede8696624f0310fb","entry_point_selector":"0x1e9ee9cbc75b846f997b5e620ff40e5c51ab4dc46de26c0f86a7d21f70ad5cb","calldata":[]},"block_id":"latest"},"id":1}' \
  | jq -r '.result[0] // .error.message' 2>/dev/null || echo "RPC call failed or jq not installed"

echo -e "\n=== Done ==="

