#!/bin/bash

# Verification script to check if everything is ready for deployment

echo "🔍 Verifying deployment setup..."
echo ""

ERRORS=0

# Check sncast
if ! command -v sncast &> /dev/null; then
    echo "❌ sncast not found. Install Starknet Foundry:"
    echo "   asdf install starknet-foundry latest"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ sncast found: $(sncast --version 2>&1 | head -1)"
fi

# Check jq
if ! command -v jq &> /dev/null; then
    echo "❌ jq not found. Install: brew install jq"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ jq found"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install Node.js 18+"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Node.js found: $(node --version)"
fi

# Check contracts are built (check if target directory exists and has files)
if [ ! -d "../contracts/target" ] || [ -z "$(find ../contracts/target -name '*.sierra.json' 2>/dev/null | head -1)" ]; then
    echo "⚠️  Contracts may not be built. Run: cd ../contracts && scarb build"
    echo "   (This is OK - sncast will build if needed)"
else
    echo "✅ Contracts built"
fi

# Check scripts
if [ ! -f "deploy.sh" ]; then
    echo "❌ deploy.sh missing"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ deploy.sh exists"
fi

if [ ! -f "generate_merkle.ts" ]; then
    echo "❌ generate_merkle.ts missing"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ generate_merkle.ts exists"
fi

# Check snapshot example
if [ ! -f "../snapshot.example.json" ]; then
    echo "❌ snapshot.example.json missing"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ snapshot.example.json exists"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed! Ready for deployment."
    echo ""
    echo "Next steps:"
    echo "1. Create snapshot.json from snapshot.example.json"
    echo "2. Generate merkle tree: npx ts-node generate_merkle.ts ../snapshot.json"
    echo "3. Set environment variables (ADMIN, MERKLE_ROOT, NETWORK)"
    echo "4. Run: ./deploy.sh"
else
    echo "❌ Found $ERRORS issue(s). Please fix before deploying."
    exit 1
fi

