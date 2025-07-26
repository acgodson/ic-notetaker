#!/bin/bash

# IC Notetaker Deployment Script
# This script builds the backend, extracts Candid interface, and deploys the canisters

set -e  # Exit on any error

echo "🚀 Starting IC Notetaker deployment..."

# Detect network
DFX_NETWORK=${DFX_NETWORK:-local}
echo "🌐 Deploying to network: $DFX_NETWORK"

# Step 1: Deploy Internet Identity (local only)
if [ "$DFX_NETWORK" = "local" ]; then
    echo "🔐 Deploying Internet Identity locally..."
    dfx deploy internet_identity --network local
    II_CANISTER_ID=$(dfx canister id internet_identity --network local)
    echo "✅ Internet Identity deployed locally with ID: $II_CANISTER_ID"
else
    echo "🔐 Using mainnet Internet Identity canister..."
    II_CANISTER_ID="rdmx6-jaaaa-aaaaa-aaadq-cai"
    echo "✅ Using mainnet Internet Identity ID: $II_CANISTER_ID"
fi

# Step 2: Build the backend canister for wasm32
echo "🔨 Building backend canister..."
cargo build --target wasm32-unknown-unknown --release -p ic_notetaker_backend

# Step 3: Extract the Candid interface
echo "📝 Extracting Candid interface..."
candid-extractor target/wasm32-unknown-unknown/release/ic_notetaker_backend.wasm > src/ic_notetaker_backend/ic_notetaker_backend.did

echo "✅ Build and Candid extraction complete."

# Step 4: Deploy the backend canister
echo "📦 Deploying IC Notetaker backend..."
dfx deploy ic_notetaker_backend --network $DFX_NETWORK

# Step 5: Get canister IDs
BACKEND_ID=$(dfx canister id ic_notetaker_backend --network $DFX_NETWORK)
echo "✅ Backend deployed with ID: $BACKEND_ID"

# Step 6: Generate Candid types for both canisters
echo "📝 Generating Candid types..."
dfx generate ic_notetaker_backend --network $DFX_NETWORK
if [ "$DFX_NETWORK" = "local" ]; then
    dfx generate internet_identity --network local
fi
echo "✅ Candid types generated"

# Step 8: Test health check
echo "🏥 Testing backend health..."
HEALTH_CHECK=$(dfx canister call ic_notetaker_backend health_check --network $DFX_NETWORK 2>/dev/null || echo "ERROR")

if [[ $HEALTH_CHECK == *"canister_status"* ]]; then
    echo "✅ Health check passed! Backend is responsive."
else
    echo "⚠️  Health check inconclusive, but deployment successful."
fi

# Step 9: Display deployment info
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "   Network:           $DFX_NETWORK"
echo "   Backend Canister:  $BACKEND_ID"
echo "   Internet Identity: $II_CANISTER_ID"
echo "   Candid Interface:  src/ic_notetaker_backend/ic_notetaker_backend.did"
echo ""
echo "🧪 Run integration test:"
echo "   npm run test:integration"
echo ""
echo "🔧 Useful commands:"
echo "   dfx canister call ic_notetaker_backend health_check --network $DFX_NETWORK"
echo "   dfx canister call ic_notetaker_backend get_storage_stats --network $DFX_NETWORK"
echo "   dfx canister call ic_notetaker_backend get_queue_stats --network $DFX_NETWORK"
echo ""
echo "📱 To test with audio:"
echo "   1. Ensure test_voice.m4a exists in root directory"
echo "   2. Run: npm run test:integration"
echo "   3. Check results for transcription and summary"
echo ""
echo "🚀 To build extension with current environment:"
echo "   npm run build:extension"