// Auto-generated IC service types
// Generated from: dfx generate ic_notetaker_backend && dfx generate internet_identity

import { Actor, HttpAgent } from '@dfinity/agent'
import { Principal } from '@dfinity/principal'

// Import the generated services
import { 
  idlFactory as icNotetakerIdlFactory,
  canisterId as icNotetakerCanisterId,
  createActor as createICNotetakerActor 
} from './index.js'

import { 
  idlFactory as internetIdentityIdlFactory,
  canisterId as internetIdentityCanisterId,
  createActor as createInternetIdentityActor 
} from './internet-identity.js'

// Re-export for easy use in extension
export { 
  icNotetakerIdlFactory,
  icNotetakerCanisterId,
  createICNotetakerActor,
  internetIdentityIdlFactory,
  internetIdentityCanisterId,
  createInternetIdentityActor
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

export function createInternetIdentityActorWithOptions(options = {}) {
  const defaultOptions = {
    agentOptions: {
      host: process.env.IC_HOST || 'https://icp-api.io'
    }
  }
  
  return createInternetIdentityActor(internetIdentityCanisterId, {
    ...defaultOptions,
    ...options
  })
}

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
