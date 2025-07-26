/// <reference types="vite/client" />
/// <reference types="chrome" />

// Extend ImportMeta interface to include our custom env vars
interface ImportMetaEnv {
  readonly DFX_NETWORK: string
  readonly CANISTER_ID_INTERNET_IDENTITY: string
  readonly CANISTER_ID_IC_NOTETAKER_BACKEND: string
  readonly IC_HOST: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Extend process.env for build-time environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    readonly DFX_NETWORK: string
    readonly CANISTER_ID_INTERNET_IDENTITY: string
    readonly CANISTER_ID_IC_NOTETAKER_BACKEND: string
    readonly IC_HOST: string
    readonly NODE_ENV: string
  }
}

// Chrome extension globals
declare const chrome: typeof chrome
declare const browser: typeof browser

// Global types for extension
interface ExtensionMessage {
  action: string
  data?: any
}

interface MeetingData {
  meetingId: string
  title?: string
  platform: string
}

interface AudioData {
  meetingId: string
  audioData: number[]
  timestamp: number
}