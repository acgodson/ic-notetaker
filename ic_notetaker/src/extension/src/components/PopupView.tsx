import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Mic, 
  Square, 
  Settings, 
  History, 
  HelpCircle,
  Video,
  Phone,
  Users,
  MessageSquare,
  Globe
} from 'lucide-react'

interface MeetingStatus {
  isMeetingDetected: boolean
  isRecording: boolean
  meetingId?: string
  platform: string
  recordingDuration: number
}

const PopupView: React.FC = () => {
  const [meetingStatus, setMeetingStatus] = useState<MeetingStatus>({
    isMeetingDetected: false,
    isRecording: false,
    platform: 'Unknown',
    recordingDuration: 0
  })
  const [loading, setLoading] = useState(true)

  // Get meeting status from content script
  const getMeetingStatus = async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_MEETING_STATUS' })
        if (response) {
          setMeetingStatus(response)
        }
      }
    } catch (error) {
      console.log('No meeting content script found')
    } finally {
      setLoading(false)
    }
  }

  // Initialize and refresh status
  useEffect(() => {
    getMeetingStatus()
    const interval = setInterval(getMeetingStatus, 2000) // Update every 2 seconds
    return () => clearInterval(interval)
  }, [])

  const handleStartRecording = async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        await chrome.tabs.sendMessage(tabs[0].id, { action: 'START_RECORDING' })
        getMeetingStatus() // Refresh status
      }
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const handleStopRecording = async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        await chrome.tabs.sendMessage(tabs[0].id, { action: 'STOP_RECORDING' })
        getMeetingStatus() // Refresh status
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

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />
      case 'connecting':
        return <Loader className="w-4 h-4 text-yellow-500 animate-spin" />
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-500" />
    }
  }

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected to IC'
      case 'connecting':
        return 'Connecting...'
      case 'disconnected':
        return 'Disconnected'
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'Google Meet':
        return <Video className="w-4 h-4" />
      case 'Zoom':
        return <Video className="w-4 h-4" />
      case 'Microsoft Teams':
        return <Users className="w-4 h-4" />
      case 'Webex':
        return <Phone className="w-4 h-4" />
      case 'Discord':
        return <MessageSquare className="w-4 h-4" />
      default:
        return <Globe className="w-4 h-4" />
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'Google Meet':
        return 'bg-green-100 text-green-800'
      case 'Zoom':
        return 'bg-blue-100 text-blue-800'
      case 'Microsoft Teams':
        return 'bg-purple-100 text-purple-800'
      case 'Webex':
        return 'bg-orange-100 text-orange-800'
      case 'Discord':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSupportedPlatforms = () => [
    { name: 'Google Meet', icon: <Video className="w-4 h-4" />, color: 'text-green-400' },
    { name: 'Zoom', icon: <Video className="w-4 h-4" />, color: 'text-blue-400' },
    { name: 'Microsoft Teams', icon: <Users className="w-4 h-4" />, color: 'text-purple-400' },
    { name: 'Webex', icon: <Phone className="w-4 h-4" />, color: 'text-orange-400' },
    { name: 'Discord', icon: <MessageSquare className="w-4 h-4" />, color: 'text-indigo-400' }
  ]

  if (loading) {
    return (
      <div className="h-full flex flex-col gradient-bg text-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl mb-2">🎙️</div>
            <p className="text-sm opacity-75">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gradient-bg text-white">
      {/* Header */}
      <header className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">🎙️ IC Notetaker</h1>
          <div className="text-xs opacity-75">Anonymous</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 flex flex-col justify-center">
        {meetingStatus.isMeetingDetected ? (
          <div className="space-y-6">
            {/* Platform Info */}
            <div className="text-center">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-2 ${getPlatformColor(meetingStatus.platform)}`}>
                {getPlatformIcon(meetingStatus.platform)}
                {meetingStatus.platform}
              </div>
              <p className="text-sm opacity-80">Meeting detected</p>
            </div>

            {/* Recording Controls */}
            <div className="text-center space-y-4">
              {!meetingStatus.isRecording ? (
                <button
                  onClick={handleStartRecording}
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 
                           border border-white/30 text-white px-6 py-3 rounded-full 
                           font-medium transition-all duration-200 hover:scale-105"
                >
                  <Mic className="w-4 h-4" />
                  Start Recording
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={handleStopRecording}
                    className="inline-flex items-center gap-2 bg-red-500/30 hover:bg-red-500/50 
                             border border-red-400/50 text-white px-6 py-3 rounded-full 
                             font-medium transition-all duration-200 hover:scale-105"
                  >
                    <Square className="w-4 h-4" />
                    Stop Recording
                  </button>
                  
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Recording: {formatDuration(meetingStatus.recordingDuration)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Meeting Info */}
            {meetingStatus.meetingId && (
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-xs opacity-75 mb-1">Meeting ID</p>
                <p className="text-sm font-mono">{meetingStatus.meetingId.slice(-8)}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4 opacity-80">
            <div className="text-4xl mb-4">🚫</div>
            <h3 className="text-base font-medium">No meeting detected</h3>
            <div className="grid grid-cols-1 gap-2 text-sm max-w-48 mx-auto">
              {getSupportedPlatforms().map((platform) => (
                <div key={platform.name} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <div className={platform.color}>
                    {platform.icon}
                  </div>
                  <span className="text-left">{platform.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-3 border-t border-white/10">
        <div className="flex justify-around">
          <Link to="/settings" className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 transition-colors">
            <Settings className="w-4 h-4" />
            <span className="text-xs">Settings</span>
          </Link>
          <Link to="/history" className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 transition-colors">
            <History className="w-4 h-4" />
            <span className="text-xs">History</span>
          </Link>
          <button className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 transition-colors">
            <HelpCircle className="w-4 h-4" />
            <span className="text-xs">Help</span>
          </button>
        </div>
      </footer>
    </div>
  )
}

export default PopupView