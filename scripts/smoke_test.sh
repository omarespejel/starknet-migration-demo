#!/bin/bash
echo "=== Migration Portal Smoke Test ==="

# 1. Check contracts exist
echo -e "\n1. Checking Portal contract..."
curl -s -X POST https://starknet-sepolia.public.blastapi.io/rpc/v0_7 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"starknet_getClassHashAt","params":{"block_id":"latest","contract_address":"0x027d9db485a394d3aea0c3af6a82b889cb95a833cc4fe36ede8696624f0310fb"},"id":1}' \
  | grep -q "result" && echo "✅ Portal deployed" || echo "❌ Portal not found"

echo -e "\n2. Checking Token contract..."
curl -s -X POST https://starknet-sepolia.public.blastapi.io/rpc/v0_7 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"starknet_getClassHashAt","params":{"block_id":"latest","contract_address":"0x07ef08eb2287fe9a996bb3de1e284b595fab5baae51374e0d8fc088c2d4334c9"},"id":1}' \
  | grep -q "result" && echo "✅ Token deployed" || echo "❌ Token not found"

echo -e "\n3. Checking frontend..."
curl -s http://localhost:3000 2>/dev/null | grep -q "Migration" && echo "✅ Frontend running" || echo "❌ Frontend not running (start with: cd frontend && npm run dev)"

echo -e "\n=== Smoke test complete ==="
