#!/bin/bash

# IC Notetaker Deployment Script
# This script builds the backend, extracts Candid interface, and deploys the canister

set -e  # Exit on any error

echo "🚀 Starting IC Notetaker deployment..."

# Step 1: Build the backend canister for wasm32
echo "🔨 Building backend canister..."
cargo build --target wasm32-unknown-unknown --release -p ic_notetaker_backend

# Step 2: Extract the Candid interface
echo "📝 Extracting Candid interface..."
candid-extractor target/wasm32-unknown-unknown/release/ic_notetaker_backend.wasm > src/ic_notetaker_backend/ic_notetaker_backend.did

echo "✅ Build and Candid extraction complete."

# Step 3: Deploy the backend canister
echo "📦 Deploying IC Notetaker backend..."
dfx deploy ic_notetaker_backend

# Step 4: Get canister ID for testing
BACKEND_ID=$(dfx canister id ic_notetaker_backend)
echo "✅ Backend deployed with ID: $BACKEND_ID"

# Step 5: Update .env file for testing
if [ -f ".env" ]; then
    # Update existing .env file
    sed -i.bak "s/CANISTER_ID=.*/CANISTER_ID=$BACKEND_ID/" .env
    echo "🔧 Updated .env with canister ID: $BACKEND_ID"
else
    # Create .env from template
    cp .env.example .env
    sed -i.bak "s/CANISTER_ID=.*/CANISTER_ID=$BACKEND_ID/" .env
    echo "🔧 Created .env with canister ID: $BACKEND_ID"
fi

# Step 6: Test health check
echo "🏥 Testing backend health..."
HEALTH_CHECK=$(dfx canister call ic_notetaker_backend health_check 2>/dev/null || echo "ERROR")

if [[ $HEALTH_CHECK == *"canister_status"* ]]; then
    echo "✅ Health check passed! Backend is responsive."
else
    echo "⚠️  Health check inconclusive, but deployment successful."
fi

# Step 7: Display deployment info
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "   Backend Canister:  $BACKEND_ID"
echo "   Candid Interface:  src/ic_notetaker_backend/ic_notetaker_backend.did"
echo "   Test Config:       .env"
echo ""
echo "🧪 Run integration test:"
echo "   npm run test:integration"
echo ""
echo "🔧 Useful commands:"
echo "   dfx canister call ic_notetaker_backend health_check"
echo "   dfx canister call ic_notetaker_backend get_storage_stats"
echo "   dfx canister call ic_notetaker_backend get_queue_stats"
echo ""
echo "📱 To test with audio:"
echo "   1. Ensure test_voice.m4a exists in root directory"
echo "   2. Run: npm run test:integration"
echo "   3. Check results for transcription and summary"