# IC Notetaker Development Guide

## 🚀 Quick Start

### One-time setup
```bash
npm install
```
### Development workflow
```bash
# Start local IC replica
npm run dev:backend

# Develop extension (React app mode)
npm run dev
```

## 📋 Available Scripts

### Backend Development
```bash
npm run cargo:build          # Build Rust canister
npm run candid:extract       # Extract Candid interface
npm run candid:generate      # Generate JS/TS types
npm run types:generate       # Generate extension types
npm run prebuild            # Run all above steps
npm run build:backend       # Full backend build + deploy
```

### Extension Development
```bash
npm run dev                 # React dev server (localhost:3000)
npm run build:extension     # Build extension for Chrome
npm run package:extension   # Package into zip for Chrome Store
npm run release:extension   # Create release with notes
```

### Testing
```bash
npm run test:integration    # Run IC canister integration test
```

## 🏗️ Project Structure

```
ic_notetaker/
├── package.json                 # Root workspace config
├── deploy.sh                    # Legacy deploy script
├── test.ts                      # Integration test
├── src/
│   ├── ic_notetaker_backend/    # IC canister (Rust)
│   └── extension/               # Chrome extension (React + Vite)
│       ├── src/
│       │   ├── components/      # React components
│       │   ├── contexts/        # React contexts
│       │   ├── content/         # Extension content scripts
│       │   ├── background/      # Extension background script
│       │   └── ic-types/        # Generated IC types (auto-generated)
│       ├── scripts/             # Build scripts
│       └── dist/                # Built extension
└── .dfx/                        # DFX generated files
```

## 🔄 Development Workflow

### 1. Backend Changes
When you modify the Rust canister:
```bash
npm run prebuild
```
This will:
- Build the Rust canister
- Extract the Candid interface
- Generate TypeScript types
- Update extension types

### 2. Extension Development
```bash
npm run dev
```
- Opens React app at http://localhost:3000
- Full width/height for easy development
- Hot reload for components
- All React dev tools available

### 3. Extension Testing
```bash
npm run build:extension
```
- Builds to `src/extension/dist/`
- Load unpacked in Chrome extensions
- Test real extension functionality

### 4. Release
```bash
npm run package:extension
npm run release:extension
```
- Creates zip file for Chrome Web Store
- Generates release notes
- Ready for distribution

