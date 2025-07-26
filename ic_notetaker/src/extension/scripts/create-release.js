import fs from 'fs/promises'
import path from 'path'

async function createRelease() {
  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
  const version = packageJson.version
  const releasePath = path.resolve('releases')
  
  try {
    await fs.access(releasePath)
    const files = await fs.readdir(releasePath)
    const zipFile = files.find(f => f.includes(`v${version}.zip`))
    
    if (!zipFile) {
      throw new Error('No packaged extension found. Run npm run package first.')
    }
    
    // Create release notes
    const releaseNotes = `# IC Notetaker Extension v${version}

## 🚀 Features
- Meeting detection for Google Meet, Zoom, Microsoft Teams, Webex, and Discord
- Real-time audio capture and transcription
- Connection to Internet Computer (IC) canister backend
- Immutable on-chain meeting records
- AI-powered meeting summaries

## 📦 Installation
1. Download the \`${zipFile}\` file
2. Extract the contents
3. Open Chrome and go to \`chrome://extensions/\`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extracted folder
6. Pin the extension to your toolbar

## 🎯 Usage
1. Join a meeting on a supported platform
2. Click the IC Notetaker extension icon
3. Grant microphone permissions when prompted
4. Click "Start Recording" to begin transcription
5. Your meeting will be transcribed and stored on the IC blockchain

## 🔧 Requirements
- Chrome browser (version 88+)
- Microphone permissions
- Internet connection

---
Built with ❤️ for the Internet Computer ecosystem
`
    
    const notesPath = path.join(releasePath, `RELEASE_NOTES_v${version}.md`)
    await fs.writeFile(notesPath, releaseNotes)
    
    console.log('')
    console.log('🎉 Release created successfully!')
    console.log(`📝 Version: ${version}`)
    console.log(`📦 Package: ${zipFile}`)
    console.log(`📋 Release notes: RELEASE_NOTES_v${version}.md`)
    console.log('')
    console.log('Next steps:')
    console.log('1. Test the extension locally')
    console.log('2. Create a GitHub release')
    console.log('3. Upload to Chrome Web Store')
    console.log('4. Update documentation')
    
  } catch (error) {
    console.error('❌ Failed to create release:', error)
    process.exit(1)
  }
}

createRelease()