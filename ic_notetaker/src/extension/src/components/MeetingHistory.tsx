import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  FileText, 
  Search, 
  Filter,
  Download,
  ExternalLink
} from 'lucide-react'

interface Meeting {
  id: string
  title: string
  platform: string
  date: string
  duration: number
  status: 'completed' | 'recording' | 'failed'
  transcriptSegments: number
  summary?: string
}

const MeetingHistory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'completed' | 'recording' | 'failed'>('all')

  // Mock data - in real app this would come from IC canister
  const meetings: Meeting[] = [
    {
      id: 'meeting_1',
      title: 'Weekly Team Standup',
      platform: 'Google Meet',
      date: '2024-01-26T10:00:00Z',
      duration: 1800, // 30 minutes in seconds
      status: 'completed',
      transcriptSegments: 45,
      summary: 'Discussed project milestones, sprint planning, and upcoming deadlines. Team reported good progress on current tasks.'
    },
    {
      id: 'meeting_2', 
      title: 'Client Presentation',
      platform: 'Zoom',
      date: '2024-01-25T14:30:00Z',
      duration: 3600, // 1 hour
      status: 'completed',
      transcriptSegments: 89,
      summary: 'Presented Q4 results to client. Positive feedback received. Discussed expansion plans for next quarter.'
    },
    {
      id: 'meeting_3',
      title: 'Product Review Meeting',
      platform: 'Microsoft Teams',
      date: '2024-01-24T09:00:00Z',
      duration: 2700, // 45 minutes
      status: 'completed',
      transcriptSegments: 67
    }
  ]

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         meeting.platform.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filter === 'all' || meeting.status === filter
    return matchesSearch && matchesFilter
  })

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: Meeting['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'recording':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Meeting History</h1>
              <p className="text-gray-600">Browse and manage your recorded meetings</p>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search meetings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="recording">Recording</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </header>

        {/* Meeting List */}
        <div className="space-y-4">
          {filteredMeetings.length > 0 ? (
            filteredMeetings.map((meeting) => (
              <div key={meeting.id} className="card p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">
                        {meeting.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}>
                        {meeting.status}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlatformColor(meeting.platform)}`}>
                        {meeting.platform}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(meeting.date)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatDuration(meeting.duration)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{meeting.transcriptSegments} segments</span>
                      </div>
                    </div>

                    {meeting.summary && (
                      <p className="text-gray-700 text-sm mb-3 line-clamp-2">
                        {meeting.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                No meetings found
              </h3>
              <p className="text-gray-500">
                {searchTerm || filter !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Start recording meetings to see them here'
                }
              </p>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {filteredMeetings.length > 0 && (
          <div className="mt-8 bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{filteredMeetings.length}</div>
                <div className="text-sm text-gray-600">Total Meetings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {filteredMeetings.reduce((acc, m) => acc + m.duration, 0) / 3600 | 0}h
                </div>
                <div className="text-sm text-gray-600">Total Duration</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {filteredMeetings.reduce((acc, m) => acc + m.transcriptSegments, 0)}
                </div>
                <div className="text-sm text-gray-600">Total Segments</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {filteredMeetings.filter(m => m.summary).length}
                </div>
                <div className="text-sm text-gray-600">With Summaries</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MeetingHistory