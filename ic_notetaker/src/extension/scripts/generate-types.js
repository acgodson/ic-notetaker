import fs from 'fs/promises'
import path from 'path'

async function generateTypes() {
  try {
    // Read the generated declarations from dfx generate  
    const declarationsPath = path.resolve('./src/declarations/ic_notetaker_backend')
    const iiDeclarationsPath = path.resolve('./src/declarations/internet_identity')
    const indexPath = path.join(declarationsPath, 'index.js')
    const servicePathTs = path.join(declarationsPath, 'ic_notetaker_backend.did.ts')
    const iiIndexPath = path.join(iiDeclarationsPath, 'index.js')
    
    // Check if declarations exist
    try {
      await fs.access(declarationsPath)
    } catch {
      console.error('❌ IC Notetaker backend declarations not found. Run "npm run candid:generate" first.')
      process.exit(1)
    }

    let hasInternetIdentity = false
    try {
      await fs.access(iiDeclarationsPath)
      hasInternetIdentity = true
    } catch {
      console.log('⚠️  Internet Identity declarations not found (may be using mainnet)')
    }
    
    // Copy the service definitions to our extension
    const targetDir = path.resolve('src/ic-types')
    await fs.mkdir(targetDir, { recursive: true })
    
    // Copy the main service file
    if (await fs.access(indexPath).then(() => true).catch(() => false)) {
      await fs.copyFile(indexPath, path.join(targetDir, 'index.js'))
      
      // Also copy the DID file that index.js imports
      const mainDidPath = path.join(declarationsPath, 'ic_notetaker_backend.did.js')
      if (await fs.access(mainDidPath).then(() => true).catch(() => false)) {
        await fs.copyFile(mainDidPath, path.join(targetDir, 'ic_notetaker_backend.did.js'))
      }
    }
    
    // Copy Internet Identity service file (if available)
    if (hasInternetIdentity && await fs.access(iiIndexPath).then(() => true).catch(() => false)) {
      await fs.copyFile(iiIndexPath, path.join(targetDir, 'internet-identity.js'))
      
      // Also copy the DID file that internet-identity.js imports
      const iiDidPath = path.join(iiDeclarationsPath, 'internet_identity.did.js')
      if (await fs.access(iiDidPath).then(() => true).catch(() => false)) {
        await fs.copyFile(iiDidPath, path.join(targetDir, 'internet_identity.did.js'))
      }
    }
    
    // Copy TypeScript definitions if they exist
    if (await fs.access(servicePathTs).then(() => true).catch(() => false)) {
      await fs.copyFile(servicePathTs, path.join(targetDir, 'ic_notetaker_backend.did.ts'))
    }
    
    // Create a simplified import file for the extension
    const extensionServiceFile = `// Auto-generated IC service types
// Generated from: dfx generate ic_notetaker_backend${hasInternetIdentity ? ' && dfx generate internet_identity' : ''}

import { Actor, HttpAgent } from '@dfinity/agent'
import { Principal } from '@dfinity/principal'

// Import the generated services
import { 
  idlFactory as icNotetakerIdlFactory,
  canisterId as icNotetakerCanisterId,
  createActor as createICNotetakerActor 
} from './index.js'

${hasInternetIdentity ? `import { 
  idlFactory as internetIdentityIdlFactory,
  canisterId as internetIdentityCanisterId,
  createActor as createInternetIdentityActor 
} from './internet-identity.js'` : '// Internet Identity not available (using mainnet)'}

// Re-export for easy use in extension
export { 
  icNotetakerIdlFactory,
  icNotetakerCanisterId,
  createICNotetakerActor${hasInternetIdentity ? `,
  internetIdentityIdlFactory,
  internetIdentityCanisterId,
  createInternetIdentityActor` : ''}
}

// Create pre-configured actors for the extension
export function createICNotetakerActorWithOptions(options = {}) {
  const defaultOptions = {
    agentOptions: {
      host: process.env.IC_HOST || 'https://icp-api.io'
    }
  }
  
  return createICNotetakerActor(icNotetakerCanisterId, {
    ...defaultOptions,
    ...options
  })
}

${hasInternetIdentity ? `export function createInternetIdentityActorWithOptions(options = {}) {
  const defaultOptions = {
    agentOptions: {
      host: process.env.IC_HOST || 'https://icp-api.io'
    }
  }
  
  return createInternetIdentityActor(internetIdentityCanisterId, {
    ...defaultOptions,
    ...options
  })
}` : `// Internet Identity actor not available in this build
export function createInternetIdentityActorWithOptions() {
  throw new Error('Internet Identity not available - using mainnet canister directly')
}`}

// Export common types for IC Notetaker
export type StartMeetingRequest = {
  title: [] | [string]
}

export type StartMeetingResponse = {
  meeting_id: string
  status: string
}

export type AddAudioRequest = {
  meeting_id: string
  audio_data: number[]
  timestamp: [] | [bigint]
}

export type AddAudioResponse = {
  chunk_id: string
  status: string
  queue_size: number
}

export type EndMeetingRequest = {
  meeting_id: string
}

export type EndMeetingResponse = {
  meeting_id: string
  status: string
  summary: [] | [string]
  total_segments: number
}
`
    
    await fs.writeFile(path.join(targetDir, 'service.ts'), extensionServiceFile)
    console.log('✅ Created extension service wrapper')
    
    console.log('')
    console.log('🎉 IC types generated successfully!')
    console.log('📁 Location: src/ic-types/')
    console.log('📝 Import with: import { createICNotetakerActor } from "@/ic-types/"')
    
  } catch (error) {
    console.error('❌ Failed to generate types:', error)
    process.exit(1)
  }
}

generateTypes()