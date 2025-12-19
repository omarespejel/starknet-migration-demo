#!/bin/bash
# Pre-commit check: Build and test before committing

set -e

echo "🔍 Running pre-commit checks..."
echo ""

# Navigate to frontend directory
cd "$(dirname "$0")/../frontend" || exit 1

echo "📦 Installing dependencies..."
npm install --silent

echo ""
echo "🔨 Building frontend..."
if npm run build; then
    echo ""
    echo "✅ Build successful! Ready to commit."
    exit 0
else
    echo ""
    echo "❌ Build failed! Please fix errors before committing."
    exit 1
fi

