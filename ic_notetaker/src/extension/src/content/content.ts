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
        case 'GET_MEETING_STATUS':
          return Promise.resolve(this.getMeetingStatus())
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
    // Create floating consent overlay - anonymous recording only
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
            <button class="ic-btn ic-btn-primary" id="ic-start-recording">
              Start Recording
            </button>
            <button class="ic-btn ic-btn-secondary" id="ic-dismiss">
              Not Now
            </button>
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
      this.showRecordingStatus()
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

  private showRecordingStatus() {
    if (this.overlay) {
      const actionsContainer = this.overlay.querySelector('#ic-overlay-actions')
      if (actionsContainer) {
        actionsContainer.innerHTML = `
          <div class="ic-recording-status">
            <div class="ic-recording-indicator">
              <div class="ic-recording-dot"></div>
              <span id="ic-recording-timer">00:00</span>
            </div>
            <p style="font-size: 12px; margin: 12px 0; line-height: 1.4;">
              Recording in progress...<br>
              Audio is being captured and sent to IC canister.
            </p>
            <button class="ic-btn ic-btn-secondary" id="ic-stop-recording">
              Stop Recording
            </button>
          </div>
        `
        
        // Add stop recording handler
        actionsContainer.querySelector('#ic-stop-recording')?.addEventListener('click', () => {
          this.stopRecording()
          this.hideOverlay()
        })

        // Start recording timer
        this.startRecordingTimer()
        
        // Add recording indicator styles
        this.addRecordingStyles()
      }
    }
  }

  private recordingStartTime: number = 0
  private recordingTimerInterval: number | null = null

  private startRecordingTimer() {
    this.recordingStartTime = Date.now()
    
    this.recordingTimerInterval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000)
      const minutes = Math.floor(elapsed / 60)
      const seconds = elapsed % 60
      const timerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      
      const timerElement = document.getElementById('ic-recording-timer')
      if (timerElement) {
        timerElement.textContent = timerText
      }
    }, 1000)
  }

  private stopRecordingTimer() {
    if (this.recordingTimerInterval) {
      clearInterval(this.recordingTimerInterval)
      this.recordingTimerInterval = null
    }
  }

  private addRecordingStyles() {
    const existingStyle = document.getElementById('ic-recording-styles')
    if (!existingStyle) {
      const style = document.createElement('style')
      style.id = 'ic-recording-styles'
      style.textContent = `
        .ic-recording-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        
        .ic-recording-dot {
          width: 12px;
          height: 12px;
          background: #ff4444;
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        
        #ic-recording-timer {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 16px;
          font-weight: bold;
          color: #ff4444;
          text-shadow: 0 0 4px rgba(255, 68, 68, 0.3);
        }
      `
      document.head.appendChild(style)
    }
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

        // Stop recording timer
        this.stopRecordingTimer()

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

  private getMeetingStatus() {
    const url = window.location.href
    const platform = this.getPlatform()
    
    // Check if we're in a meeting platform
    const isMeetingPlatform = url.includes('meet.google.com') || 
                             url.includes('zoom.us') || 
                             url.includes('teams.microsoft.com') ||
                             url.includes('webex.com') ||
                             url.includes('discord.com')
    
    return {
      isMeetingDetected: isMeetingPlatform,
      isRecording: this.state.isRecording,
      meetingId: this.state.meetingId,
      platform: platform,
      recordingDuration: this.state.isRecording ? Math.floor((Date.now() - this.recordingStartTime) / 1000) : 0
    }
  }
}

// Initialize meeting capture when content script loads
new MeetingCapture()