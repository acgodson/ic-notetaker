# IC Notetaker Chrome Extension

Modern React + Vite Chrome extension for capturing and transcribing meetings on the Internet Computer.

## 🛠️ Development

### Setup
```bash
npm install
```

### Development (Web App Mode)
```bash
npm run dev
```
- Opens at http://localhost:3000
- Full React app with routing
- Easy component development
- Hot reload

### Build Extension
```bash
npm run build:extension
```
- Builds extension to `dist/` folder
- Optimized for Chrome extension constraints

### Package for Release
```bash
npm run package
```
- Creates zip file in `releases/` folder
- Ready for Chrome Web Store upload

### Create Release
```bash
npm run release
```
- Generates release notes
- Prepares distribution files

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── PopupView.tsx   # Main extension popup
│   ├── Dashboard.tsx   # Web app dashboard
│   └── ...
├── contexts/           # React contexts
│   └── MeetingContext.tsx
├── content/           # Extension content scripts
│   └── content.ts
├── background/        # Extension background script
│   └── background.ts
├── styles/           # CSS/Tailwind styles
├── manifest.json     # Extension manifest
└── main.tsx         # React app entry point
```

## 🚀 Development Workflow

1. **Component Development**: Use `npm run dev` for full React development
2. **Extension Testing**: Use `npm run build:extension` + load unpacked in Chrome
3. **Release**: Use `npm run package` to create distributable zip

## 🎯 Features

- **React + TypeScript**: Modern development experience  
- **Tailwind CSS**: Utility-first styling
- **Vite**: Fast builds and hot reload
- **Chrome APIs**: Full extension capabilities
- **IC Integration**: Connect to Internet Computer canisters
- **Meeting Detection**: Auto-detect Google Meet, Zoom, Teams, etc.
- **Audio Capture**: Real-time meeting transcription

## 📦 Build Targets

- **Web App** (`npm run build`): Full SPA for development/preview
- **Extension** (`npm run build:extension`): Chrome extension package
- **Package** (`npm run package`): Distribution-ready zip file