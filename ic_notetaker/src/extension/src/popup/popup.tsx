import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import '../styles/popup.css'

interface MeetingState {
  isRecording: boolean
  meetingId?: string
  platform?: string
  duration: number
}

const Popup: React.FC = () => {
  const [meetingState, setMeetingState] = useState<MeetingState>({
    isRecording: false,
    duration: 0
  })
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')

  useEffect(() => {
    // Check if we're on a supported meeting platform
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (tab?.url) {
        const platform = detectMeetingPlatform(tab.url)
        if (platform) {
          setMeetingState(prev => ({ ...prev, platform }))
        }
      }
    })

    // Check connection to IC canister
    checkConnectionStatus()
  }, [])

  const detectMeetingPlatform = (url: string): string | null => {
    if (url.includes('meet.google.com')) return 'Google Meet'
    if (url.includes('zoom.us')) return 'Zoom'
    if (url.includes('teams.microsoft.com')) return 'Microsoft Teams'
    if (url.includes('webex.com')) return 'Webex'
    if (url.includes('discord.com')) return 'Discord'
    return null
  }

  const checkConnectionStatus = async () => {
    setConnectionStatus('connecting')
    try {
      // TODO: Implement actual IC canister connection check
      // For now, simulate connection
      setTimeout(() => {
        setConnectionStatus('connected')
      }, 1000)
    } catch (error) {
      setConnectionStatus('disconnected')
    }
  }

  const startRecording = async () => {
    try {
      // Send message to content script to start recording
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, { action: 'START_RECORDING' })
        setMeetingState(prev => ({ ...prev, isRecording: true }))
      }
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const stopRecording = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, { action: 'STOP_RECORDING' })
        setMeetingState(prev => ({ ...prev, isRecording: false, duration: 0 }))
      }
    } catch (error) {
      console.error('Failed to stop recording:', error)
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="logo">
          <h2>🎙️ IC Notetaker</h2>
        </div>
        <div className={`connection-status ${connectionStatus}`}>
          <div className="status-dot"></div>
          <span>{connectionStatus === 'connected' ? 'Connected to IC' : 'Connecting...'}</span>
        </div>
      </header>

      <main className="popup-main">
        {meetingState.platform ? (
          <div className="meeting-section">
            <div className="platform-info">
              <span className="platform-badge">{meetingState.platform}</span>
              <span className="meeting-detected">Meeting detected</span>
            </div>
            
            <div className="recording-controls">
              {!meetingState.isRecording ? (
                <button 
                  className="record-button start" 
                  onClick={startRecording}
                  disabled={connectionStatus !== 'connected'}
                >
                  <span className="record-icon">⚫</span>
                  Start Recording
                </button>
              ) : (
                <div className="recording-active">
                  <button className="record-button stop" onClick={stopRecording}>
                    <span className="record-icon">⏹️</span>
                    Stop Recording
                  </button>
                  <div className="recording-info">
                    <div className="recording-indicator">
                      <span className="pulse-dot"></span>
                      Recording: {formatDuration(meetingState.duration)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {meetingState.meetingId && (
              <div className="meeting-info">
                <p className="meeting-id">Meeting ID: {meetingState.meetingId}</p>
                <button className="view-transcript">View Transcript</button>
              </div>
            )}
          </div>
        ) : (
          <div className="no-meeting">
            <div className="no-meeting-icon">🚫</div>
            <h3>No meeting detected</h3>
            <p>Navigate to a supported meeting platform:</p>
            <ul className="supported-platforms">
              <li>Google Meet</li>
              <li>Zoom</li>
              <li>Microsoft Teams</li>
              <li>Webex</li>
              <li>Discord</li>
            </ul>
          </div>
        )}
      </main>

      <footer className="popup-footer">
        <div className="footer-links">
          <button className="link-button">Settings</button>
          <button className="link-button">History</button>
          <button className="link-button">Help</button>
        </div>
      </footer>
    </div>
  )
}

const root = ReactDOM.createRoot(document.getElementById('popup-root')!)
root.render(<Popup />)