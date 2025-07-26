import browser from 'webextension-polyfill'

interface RecordingState {
  isRecording: boolean
  meetingId?: string
  audioStream?: MediaStream
  mediaRecorder?: MediaRecorder
  audioChunks: Blob[]
}

class MeetingCapture {
  private state: RecordingState = {
    isRecording: false,
    audioChunks: []
  }
  private overlay?: HTMLElement
  private uploadInterval?: number

  constructor() {
    this.init()
  }

  private init() {
    // Listen for messages from popup
    browser.runtime.onMessage.addListener((message: any) => {
      switch (message.action) {
        case 'START_RECORDING':
          return this.startRecording()
        case 'STOP_RECORDING':
          return this.stopRecording()
        case 'GET_STATUS':
          return Promise.resolve(this.getStatus())
      }
    })

    // Detect when we're in a meeting
    this.detectMeeting()
  }

  private detectMeeting() {
    const url = window.location.href
    
    // Google Meet detection
    if (url.includes('meet.google.com')) {
      this.waitForMeetingToStart('google-meet')
    }
    // Zoom detection
    else if (url.includes('zoom.us')) {
      this.waitForMeetingToStart('zoom')
    }
    // Teams detection
    else if (url.includes('teams.microsoft.com')) {
      this.waitForMeetingToStart('teams')
    }
    // Add other platforms as needed
  }

  private waitForMeetingToStart(platform: string) {
    // Different platforms have different indicators for active meetings
    const checkInterval = setInterval(() => {
      let isInMeeting = false

      switch (platform) {
        case 'google-meet':
          // Google Meet shows participant count when in meeting
          isInMeeting = document.querySelector('[data-participant-count]') !== null ||
                       document.querySelector('[jsname="A5il2e"]') !== null
          break
        case 'zoom':
          // Zoom shows meeting controls when active
          isInMeeting = document.querySelector('.meeting-client-view') !== null
          break
        case 'teams':
          // Teams shows call controls
          isInMeeting = document.querySelector('[data-tid="calling-join-button"]') === null &&
                       document.querySelector('[data-tid="call-roster-button"]') !== null
          break
      }

      if (isInMeeting && !this.overlay) {
        this.showConsentOverlay()
        clearInterval(checkInterval)
      }
    }, 2000)

    // Stop checking after 2 minutes
    setTimeout(() => clearInterval(checkInterval), 120000)
  }

  private async showConsentOverlay() {
    // Check authentication status first
    const authStatus = await this.checkAuthenticationStatus()
    
    // Create floating consent overlay
    this.overlay = document.createElement('div')
    this.overlay.id = 'ic-notetaker-overlay'
    this.overlay.innerHTML = `
      <div class="ic-overlay-content">
        <div class="ic-overlay-header">
          <h3>🎙️ IC Notetaker</h3>
          <button class="ic-close-btn">&times;</button>
        </div>
        <div class="ic-overlay-body">
          <p>Record and transcribe this meeting on the Internet Computer?</p>
          <div class="ic-overlay-actions" id="ic-overlay-actions">
            ${authStatus.isAuthenticated ? `
              <button class="ic-btn ic-btn-primary" id="ic-start-recording">
                Start Recording
              </button>
              <button class="ic-btn ic-btn-secondary" id="ic-dismiss">
                Not Now
              </button>
            ` : `
              <button class="ic-btn ic-btn-primary ic-btn-full-width" id="ic-login">
                Login with Internet Identity
              </button>
            `}
          </div>
        </div>
      </div>
    `


    const style = document.createElement('style')
    style.textContent = `
      #ic-notetaker-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.3s ease-out;
      }
      
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      .ic-overlay-content {
        padding: 0;
      }
      
      .ic-overlay-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }
      
      .ic-overlay-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      
      .ic-close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      
      .ic-close-btn:hover {
        opacity: 1;
      }
      
      .ic-overlay-body {
        padding: 16px;
      }
      
      .ic-overlay-body p {
        margin: 0 0 16px 0;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .ic-overlay-actions {
        display: flex;
        gap: 8px;
      }
      
      .ic-btn {
        flex: 1;
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .ic-btn-primary {
        background: rgba(76, 175, 80, 0.3);
        color: white;
        border: 1px solid rgba(76, 175, 80, 0.5);
      }
      
      .ic-btn-primary:hover {
        background: rgba(76, 175, 80, 0.5);
      }
      
      .ic-btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
      }
      
      .ic-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      .ic-btn-full-width {
        width: 100%;
      }
    `
    
    document.head.appendChild(style)
    document.body.appendChild(this.overlay)

    // Add event listeners
    this.overlay.querySelector('#ic-start-recording')?.addEventListener('click', () => {
      this.startRecording()
      this.hideOverlay()
    })

    this.overlay.querySelector('#ic-login')?.addEventListener('click', async () => {
      await this.handleLogin()
    })

    this.overlay.querySelector('#ic-dismiss')?.addEventListener('click', () => {
      this.hideOverlay()
    })

    this.overlay.querySelector('.ic-close-btn')?.addEventListener('click', () => {
      this.hideOverlay()
    })
  }

  private hideOverlay() {
    if (this.overlay) {
      this.overlay.remove()
      this.overlay = undefined
    }
  }

  private async checkAuthenticationStatus(): Promise<{ isAuthenticated: boolean; principalText?: string }> {
    try {
      console.log('🔍 Content Script: Checking authentication status...')
      
      // Check if extension context is valid before sending message
      if (!browser.runtime?.id) {
        console.warn('⚠️ Content Script: Extension context invalidated, cannot check auth')
        return { isAuthenticated: false }
      }
      
      // Send message to background script to check auth with retry
      const response = await this.sendMessageWithRetry({ 
        action: 'CHECK_AUTH_STATUS' 
      }) as { isAuthenticated?: boolean; principalText?: string } | undefined
      
      console.log('🔍 Content Script: Auth status response:', response)
      
      return {
        isAuthenticated: response?.isAuthenticated || false,
        principalText: response?.principalText
      }
    } catch (error) {
      console.error('❌ Content Script: Failed to check auth status:', error)
      return { isAuthenticated: false }
    }
  }

  private async handleLogin(): Promise<void> {
    try {
      console.log('🔍 Content Script: Initiating login...')
      
      // Send message to background script to open Internet Identity in new tab
      const response = await this.sendMessageWithRetry({ 
        action: 'OPEN_AUTH_TAB' 
      }) as { success?: boolean; error?: string; tabId?: number } | undefined
      
      if (response?.success) {
        console.log('✅ Content Script: Auth tab opened:', response.tabId)
        
        // Hide the overlay and show a waiting message
        this.showAuthWaitingMessage()
        
        // Start polling for auth status
        this.startAuthPolling()
      } else {
        console.error('❌ Content Script: Failed to open auth tab:', response?.error)
      }
      
    } catch (error) {
      console.error('❌ Content Script: Login process failed:', error)
    }
  }

  private showAuthWaitingMessage(): void {
    if (this.overlay) {
      const actionsContainer = this.overlay.querySelector('#ic-overlay-actions')
      if (actionsContainer) {
        actionsContainer.innerHTML = `
          <div class="ic-auth-waiting">
            <p style="font-size: 12px; margin-bottom: 12px; line-height: 1.4;">
              <strong>Instructions:</strong><br>
              1. Create or sign in with your Internet Identity<br>
              2. Return to this tab - we'll detect your authentication automatically
            </p>
            <button class="ic-btn ic-btn-secondary" id="ic-cancel-auth">
              Cancel
            </button>
          </div>
        `
        
        // Add cancel handler
        actionsContainer.querySelector('#ic-cancel-auth')?.addEventListener('click', () => {
          this.stopAuthPolling()
          this.hideOverlay()
        })
      }
    }
  }

  private authPollingInterval: ReturnType<typeof setInterval> | null = null

  private startAuthPolling(): void {
    console.log('🔄 Content Script: Starting auth polling...')
    
    this.authPollingInterval = setInterval(async () => {
      try {
        const authStatus = await this.checkAuthenticationStatus()
        console.log('🔄 Content Script: Polling auth status:', authStatus.isAuthenticated)
        
        if (authStatus.isAuthenticated) {
          console.log('✅ Content Script: Authentication successful!')
          this.stopAuthPolling()
          await this.updateOverlayAfterLogin()
        }
      } catch (error) {
        console.warn('⚠️ Content Script: Auth polling error:', error)
      }
    }, 2000) // Check every 2 seconds
    
    // Stop polling after 5 minutes
    setTimeout(() => {
      if (this.authPollingInterval) {
        console.log('⏱️ Content Script: Auth polling timeout')
        this.stopAuthPolling()
      }
    }, 300000)
  }

  private stopAuthPolling(): void {
    if (this.authPollingInterval) {
      clearInterval(this.authPollingInterval)
      this.authPollingInterval = null
      console.log('🛑 Content Script: Auth polling stopped')
    }
  }

  private showAuthRedirectMessage(): void {
    // Create a temporary message overlay
    const messageOverlay = document.createElement('div')
    messageOverlay.id = 'ic-auth-redirect-message'
    messageOverlay.innerHTML = `
      <div class="ic-overlay-content">
        <div class="ic-overlay-header">
          <h3>🎙️ IC Notetaker</h3>
          <button class="ic-close-btn" id="ic-close-message">&times;</button>
        </div>
        <div class="ic-overlay-body">
          <p>Please use the extension popup (click the IC Notetaker icon in your browser toolbar) to authenticate with Internet Identity.</p>
          <div class="ic-overlay-actions">
            <button class="ic-btn ic-btn-secondary" id="ic-got-it">
              Got it
            </button>
          </div>
        </div>
      </div>
    `
    
    // Use the same styles as the main overlay
    messageOverlay.style.cssText = this.overlay?.style.cssText || ''
    
    document.body.appendChild(messageOverlay)
    
    // Add event listeners
    messageOverlay.querySelector('#ic-close-message')?.addEventListener('click', () => {
      messageOverlay.remove()
    })
    
    messageOverlay.querySelector('#ic-got-it')?.addEventListener('click', () => {
      messageOverlay.remove()
    })
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (messageOverlay.parentNode) {
        messageOverlay.remove()
      }
    }, 10000)
  }

  private async sendMessageWithRetry(message: any, maxRetries: number = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if extension context is still valid
        if (!browser.runtime?.id) {
          throw new Error('Extension context invalidated')
        }
        
        console.log(`🔍 Content Script: Sending message (attempt ${attempt}/${maxRetries}):`, message.action)
        const response = await browser.runtime.sendMessage(message)
        console.log(`✅ Content Script: Message sent successfully on attempt ${attempt}`)
        return response
      } catch (error) {
        console.warn(`⚠️ Content Script: Message failed on attempt ${attempt}:`, error)
        
        if (attempt === maxRetries) {
          throw error
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`🔄 Content Script: Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  private async updateOverlayAfterLogin(): Promise<void> {
    const actionsContainer = this.overlay?.querySelector('#ic-overlay-actions')
    if (actionsContainer) {
      actionsContainer.innerHTML = `
        <button class="ic-btn ic-btn-primary" id="ic-start-recording">
          Start Recording
        </button>
        <button class="ic-btn ic-btn-secondary" id="ic-dismiss">
          Not Now
        </button>
      `
      
      // Re-attach event listeners
      actionsContainer.querySelector('#ic-start-recording')?.addEventListener('click', () => {
        this.startRecording()
        this.hideOverlay()
      })
      
      actionsContainer.querySelector('#ic-dismiss')?.addEventListener('click', () => {
        this.hideOverlay()
      })
    }
  }

  private async startRecording(): Promise<void> {
    try {
      // Request tab audio capture permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      this.state.audioStream = stream
      this.state.isRecording = true
      this.state.audioChunks = []

      // Create MediaRecorder
      this.state.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      this.state.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.state.audioChunks.push(event.data)
        }
      }

      // Start recording and send chunks every 30 seconds
      this.state.mediaRecorder.start()
      this.startUploadInterval()

      // Create meeting on IC canister
      await this.createMeeting()

      console.log('IC Notetaker: Recording started')
    } catch (error) {
      console.error('IC Notetaker: Failed to start recording:', error)
      throw error
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      if (this.state.mediaRecorder && this.state.isRecording) {
        this.state.mediaRecorder.stop()
        this.state.audioStream?.getTracks().forEach(track => track.stop())
        
        if (this.uploadInterval) {
          clearInterval(this.uploadInterval)
        }

        // Upload final audio chunk
        await this.uploadAudioChunk()

        // End meeting on IC canister
        await this.endMeeting()

        this.state.isRecording = false
        this.state.audioChunks = []
        
        console.log('IC Notetaker: Recording stopped')
      }
    } catch (error) {
      console.error('IC Notetaker: Failed to stop recording:', error)
      throw error
    }
  }

  private startUploadInterval() {
    this.uploadInterval = window.setInterval(async () => {
      if (this.state.audioChunks.length > 0) {
        await this.uploadAudioChunk()
      }
    }, 30000) // Upload every 30 seconds
  }

  private async uploadAudioChunk(): Promise<void> {
    if (this.state.audioChunks.length === 0) return

    try {
      // Combine audio chunks into single blob
      const audioBlob = new Blob(this.state.audioChunks, { type: 'audio/webm' })
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioArray = Array.from(new Uint8Array(arrayBuffer))

      // Send to background script for IC canister upload
      await browser.runtime.sendMessage({
        action: 'UPLOAD_AUDIO',
        data: {
          meetingId: this.state.meetingId,
          audioData: audioArray,
          timestamp: Date.now()
        }
      })

      // Clear uploaded chunks
      this.state.audioChunks = []
      
      console.log('IC Notetaker: Audio chunk uploaded')
    } catch (error) {
      console.error('IC Notetaker: Failed to upload audio chunk:', error)
    }
  }

  private async createMeeting(): Promise<void> {
    try {
      const response = await this.sendMessageWithRetry({
        action: 'CREATE_MEETING',
        data: {
          title: this.getMeetingTitle(),
          platform: this.getPlatform()
        }
      }) as { meetingId?: string } | undefined

      if (response?.meetingId) {
        this.state.meetingId = response.meetingId
      }
    } catch (error) {
      console.error('IC Notetaker: Failed to create meeting:', error)
    }
  }

  private async endMeeting(): Promise<void> {
    if (!this.state.meetingId) return

    try {
      await browser.runtime.sendMessage({
        action: 'END_MEETING',
        data: {
          meetingId: this.state.meetingId
        }
      })
    } catch (error) {
      console.error('IC Notetaker: Failed to end meeting:', error)
    }
  }

  private getMeetingTitle(): string {
    // Try to extract meeting title from page
    const title = document.title
    const url = window.location.href

    if (url.includes('meet.google.com')) {
      return title.replace(' - Google Meet', '') || 'Google Meet'
    } else if (url.includes('zoom.us')) {
      return 'Zoom Meeting'
    } else if (url.includes('teams.microsoft.com')) {
      return 'Microsoft Teams Meeting'
    }

    return 'Meeting'
  }

  private getPlatform(): string {
    const url = window.location.href
    if (url.includes('meet.google.com')) return 'Google Meet'
    if (url.includes('zoom.us')) return 'Zoom'
    if (url.includes('teams.microsoft.com')) return 'Microsoft Teams'
    if (url.includes('webex.com')) return 'Webex'
    if (url.includes('discord.com')) return 'Discord'
    return 'Unknown'
  }

  private getStatus() {
    return {
      isRecording: this.state.isRecording,
      meetingId: this.state.meetingId,
      platform: this.getPlatform()
    }
  }
}

// Initialize meeting capture when content script loads
new MeetingCapture()