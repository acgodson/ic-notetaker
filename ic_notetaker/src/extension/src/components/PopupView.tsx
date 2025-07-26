import React from 'react'
import { useAuthStore } from '../stores/authStore'
import { useMeetingStore } from '../stores/meetingStore'
import { 
  Mic, 
  MicOff, 
  Square, 
  Settings, 
  History, 
  HelpCircle,
  Wifi,
  WifiOff,
  Loader,
  Video,
  Phone,
  Users,
  MessageSquare,
  Globe,
  LogIn,
  User,
  AlertCircle
} from 'lucide-react'

const PopupView: React.FC = () => {
  // Zustand stores
  const { 
    isAuthenticated, 
    login, 
    logout, 
    principalText, 
    isLoading: authLoading, 
    icNotetakerActor,
    error: authError,
    init: initAuth,
    clearError: clearAuthError
  } = useAuthStore()

  const {
    isRecording,
    meetingId,
    platform,
    duration,
    connectionStatus,
    error: meetingError,
    checkConnection,
    createMeeting,
    stopRecording,
    clearError: clearMeetingError,
    setPlatform,
    detectPlatform
  } = useMeetingStore()

  // Initialize auth and detect platform on mount
  React.useEffect(() => {
    console.log('🔍 PopupView: Initializing...')
    initAuth()
    
    const detectedPlatform = detectPlatform()
    if (detectedPlatform) {
      setPlatform(detectedPlatform)
    }
    
    checkConnection()
  }, [initAuth, detectPlatform, setPlatform, checkConnection])

  // Debug state
  React.useEffect(() => {
    console.log('🔍 PopupView: State update:', { 
      isAuthenticated, 
      principalText, 
      authLoading,
      hasActor: !!icNotetakerActor,
      platform,
      connectionStatus,
      authError,
      meetingError
    })
  }, [isAuthenticated, principalText, authLoading, icNotetakerActor, platform, connectionStatus, authError, meetingError])

  const handleStartRecording = async () => {
    try {
      clearMeetingError()
      await createMeeting()
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const handleLogin = async () => {
    try {
      clearAuthError()
      await login()
    } catch (error) {
      console.error('Login failed:', error)
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

  return (
    <div className="h-full flex flex-col gradient-bg text-white">
      {/* Header */}
      <header className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">🎙️ IC Notetaker</h1>
          {isAuthenticated ? (
            <button 
              onClick={logout}
              className="flex items-center gap-1 text-xs opacity-75 hover:opacity-100 transition-opacity"
            >
              <User className="w-3 h-3" />
              Logout
            </button>
          ) : (
            <button 
              onClick={checkConnection}
              className="text-xs opacity-75 hover:opacity-100 transition-opacity"
            >
              Refresh
            </button>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {getConnectionIcon()}
            <span className="opacity-90">{getConnectionText()}</span>
          </div>
          {isAuthenticated && principalText && (
            <div className="text-xs opacity-75">
              {principalText.slice(0, 8)}...
            </div>
          )}
        </div>

        {/* Error Messages */}
        {(authError || meetingError) && (
          <div className="mt-2 p-2 bg-red-500/20 border border-red-400/50 rounded text-xs flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            <span>{authError || meetingError}</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 flex flex-col justify-center">
        {platform ? (
          <div className="space-y-6">
            {/* Platform Info */}
            <div className="text-center">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-2 ${getPlatformColor(platform)}`}>
                {getPlatformIcon(platform)}
                {platform}
              </div>
              <p className="text-sm opacity-80">Meeting detected</p>
            </div>

            {/* Recording Controls */}
            <div className="text-center space-y-4">
              {!isAuthenticated ? (
                <div className="space-y-3">
                  <p className="text-sm opacity-80">Sign in to start recording</p>
                  <button
                    onClick={handleLogin}
                    disabled={authLoading}
                    className="inline-flex items-center gap-2 bg-blue-500/30 hover:bg-blue-500/50 
                             disabled:opacity-50 disabled:cursor-not-allowed
                             border border-blue-400/50 text-white px-6 py-3 rounded-full 
                             font-medium transition-all duration-200 hover:scale-105"
                  >
                    {authLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    {authLoading ? 'Connecting...' : 'Login with Internet Identity'}
                  </button>
                </div>
              ) : !isRecording ? (
                <button
                  onClick={handleStartRecording}
                  disabled={connectionStatus !== 'connected' || !isAuthenticated || !icNotetakerActor}
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 
                           disabled:opacity-50 disabled:cursor-not-allowed
                           border border-white/30 text-white px-6 py-3 rounded-full 
                           font-medium transition-all duration-200 hover:scale-105"
                >
                  <Mic className="w-4 h-4" />
                  Start Recording
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 bg-red-500/30 hover:bg-red-500/50 
                             border border-red-400/50 text-white px-6 py-3 rounded-full 
                             font-medium transition-all duration-200 hover:scale-105"
                  >
                    <Square className="w-4 h-4" />
                    Stop Recording
                  </button>
                  
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Recording: {formatDuration(duration)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Meeting Info */}
            {meetingId && (
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-xs opacity-75 mb-1">Meeting ID</p>
                <p className="text-sm font-mono">{meetingId.slice(-8)}</p>
                <button className="mt-2 text-xs underline opacity-75 hover:opacity-100">
                  View Transcript
                </button>
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
          <button className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 transition-colors">
            <Settings className="w-4 h-4" />
            <span className="text-xs">Settings</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 transition-colors">
            <History className="w-4 h-4" />
            <span className="text-xs">History</span>
          </button>
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