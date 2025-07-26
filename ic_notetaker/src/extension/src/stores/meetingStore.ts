import { create } from 'zustand'

interface TranscriptSegment {
  id: string
  text: string
  timestamp: number
  speaker?: string
}

interface Meeting {
  id: string
  title: string
  platform: string
  startTime: number
  endTime?: number
  status: 'active' | 'ended'
  summary?: string
}

interface MeetingState {
  // State
  isRecording: boolean
  meetingId?: string
  platform?: string
  duration: number
  connectionStatus: 'connected' | 'connecting' | 'disconnected'
  transcript: TranscriptSegment[]
  currentMeeting?: Meeting
  error: string | null

  // Actions
  startRecording: (meetingId: string, platform: string) => void
  stopRecording: () => void
  updateDuration: (duration: number) => void
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => void
  addTranscript: (segment: TranscriptSegment) => void
  setPlatform: (platform: string) => void
  setCurrentMeeting: (meeting: Meeting) => void
  detectPlatform: () => string | null
  checkConnection: () => Promise<void>
  createMeeting: () => Promise<void>
  clearError: () => void
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  // Initial state
  isRecording: false,
  duration: 0,
  connectionStatus: 'disconnected',
  transcript: [],
  error: null,

  clearError: () => set({ error: null }),

  startRecording: (meetingId: string, platform: string) => {
    set({
      isRecording: true,
      meetingId,
      platform,
      duration: 0,
      error: null
    })
  },

  stopRecording: () => {
    set({
      isRecording: false,
      duration: 0
    })
  },

  updateDuration: (duration: number) => {
    set({ duration })
  },

  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => {
    set({ connectionStatus: status })
  },

  addTranscript: (segment: TranscriptSegment) => {
    set(state => ({
      transcript: [...state.transcript, segment]
    }))
  },

  setPlatform: (platform: string) => {
    set({ platform })
  },

  setCurrentMeeting: (meeting: Meeting) => {
    set({ currentMeeting: meeting })
  },

  detectPlatform: (): string | null => {
    if (typeof window === 'undefined') return null
    
    const url = window.location.href
    if (url.includes('meet.google.com')) return 'Google Meet'
    if (url.includes('zoom.us')) return 'Zoom'
    if (url.includes('teams.microsoft.com')) return 'Microsoft Teams'
    if (url.includes('webex.com')) return 'Webex'
    if (url.includes('discord.com')) return 'Discord'
    return null
  },

  checkConnection: async () => {
    set({ connectionStatus: 'connecting', error: null })
    
    try {
      // Check if running as extension
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // Send health check message to background script
        const response = await chrome.runtime.sendMessage({ action: 'HEALTH_CHECK' })
        console.log('🔍 MeetingStore: Health check response:', response)
        
        if (response && !response.error) {
          set({ connectionStatus: 'connected' })
        } else {
          set({ connectionStatus: 'disconnected', error: 'Health check failed' })
        }
      } else {
        // Running as web app - simulate connection
        setTimeout(() => {
          set({ connectionStatus: 'connected' })
        }, 1000)
      }
    } catch (error) {
      console.error('❌ MeetingStore: Connection check failed:', error)
      set({ 
        connectionStatus: 'disconnected',
        error: error instanceof Error ? error.message : 'Connection check failed'
      })
    }
  },

  createMeeting: async () => {
    try {
      const { platform } = get()
      set({ error: null })

      if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('🔍 MeetingStore: Creating meeting via background script...')
        
        // Extension mode - send message to background script to create meeting
        const response = await chrome.runtime.sendMessage({ 
          action: 'CREATE_MEETING',
          data: {
            title: `Meeting on ${platform || 'Unknown Platform'}`,
            platform: platform || 'Unknown'
          }
        })
        
        if (response?.meetingId) {
          get().startRecording(response.meetingId, platform || 'Unknown')
          console.log('✅ MeetingStore: Meeting created:', response.meetingId)
        } else {
          throw new Error(response?.error || 'Failed to create meeting')
        }
      } else {
        // Web app mode - simulate recording
        const mockMeetingId = `meeting_${Date.now()}`
        get().startRecording(mockMeetingId, platform || 'Web Demo')
        console.log('✅ MeetingStore: Mock meeting created:', mockMeetingId)
      }
    } catch (error) {
      console.error('❌ MeetingStore: Failed to create meeting:', error)
      set({ error: error instanceof Error ? error.message : 'Failed to create meeting' })
      throw error
    }
  }
}))

// Initialize platform detection and connection check
if (typeof window !== 'undefined') {
  // Auto-detect platform on load
  const platform = useMeetingStore.getState().detectPlatform()
  if (platform) {
    useMeetingStore.getState().setPlatform(platform)
  }

  // Check connection on load
  useMeetingStore.getState().checkConnection()
}