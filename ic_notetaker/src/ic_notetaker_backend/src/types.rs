use candid::{CandidType, Deserialize, Principal};
use ic_stable_structures::storable::Storable;
use serde::Serialize;
use std::borrow::Cow;

/// Meeting identifier
pub type MeetingId = String;

/// Audio chunk identifier
pub type ChunkId = String;

/// Meeting status
#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub enum MeetingStatus {
    Active,
    Ended,
    AutoEnded, // Ended due to 24hr timeout
}

/// Audio processing status
#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub enum ProcessingStatus {
    Queued,
    Processing,
    Completed,
    Failed(String),
}

/// Audio chunk waiting for processing
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct AudioChunk {
    pub chunk_id: ChunkId,
    pub meeting_id: MeetingId,
    pub audio_data: Vec<u8>, // Base64 encoded audio
    pub timestamp: u64,
    pub status: ProcessingStatus,
    pub retry_count: u32,
}

/// Transcript segment from processed audio
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct TranscriptSegment {
    pub chunk_id: ChunkId,
    pub text: String,
    pub timestamp: u64,
    pub confidence: Option<f32>,
}

/// Complete meeting record
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct Meeting {
    pub meeting_id: MeetingId,
    pub owner: Principal,
    pub title: Option<String>,
    pub status: MeetingStatus,
    pub created_at: u64,
    pub ended_at: Option<u64>,
    pub last_activity: u64,
    pub transcript_segments: Vec<TranscriptSegment>,
    pub summary: Option<String>,
}

/// Request to start a new meeting
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct StartMeetingRequest {
    pub title: Option<String>,
}

/// Response when starting a meeting
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct StartMeetingResponse {
    pub meeting_id: MeetingId,
    pub status: String,
}

/// Request to add audio chunk to meeting
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct AddAudioRequest {
    pub meeting_id: MeetingId,
    pub audio_data: Vec<u8>, // Base64 encoded
    pub timestamp: Option<u64>,
}

/// Response when adding audio
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct AddAudioResponse {
    pub chunk_id: ChunkId,
    pub status: String,
    pub queue_size: u32,
}

/// Request to end a meeting
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EndMeetingRequest {
    pub meeting_id: MeetingId,
}

/// Response when ending a meeting
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct EndMeetingResponse {
    pub meeting_id: MeetingId,
    pub status: String,
    pub summary: Option<String>,
    pub total_segments: u32,
}

/// Meeting summary for listing
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct MeetingSummary {
    pub meeting_id: MeetingId,
    pub title: Option<String>,
    pub status: MeetingStatus,
    pub created_at: u64,
    pub ended_at: Option<u64>,
    pub segment_count: u32,
    pub has_summary: bool,
}

/// OpenAI API request for transcription
#[derive(Serialize, Debug)]
pub struct OpenAITranscriptionRequest {
    pub file: String, // Base64 encoded audio
    pub model: String,
    pub response_format: String,
    pub timestamp_granularities: Vec<String>,
}

/// OpenAI API response for transcription
#[derive(Deserialize, Debug)]
pub struct OpenAITranscriptionResponse {
    pub text: String,
    pub segments: Option<Vec<OpenAISegment>>,
}

#[derive(Deserialize, Debug)]
pub struct OpenAISegment {
    pub start: f32,
    pub end: f32,
    pub text: String,
}

/// OpenAI API request for summarization
#[derive(Serialize, Debug)]
pub struct OpenAIChatRequest {
    pub model: String,
    pub messages: Vec<OpenAIMessage>,
    pub max_tokens: u32,
    pub temperature: f32,
}

#[derive(Serialize, Debug)]
pub struct OpenAIMessage {
    pub role: String,
    pub content: String,
}

/// OpenAI API response for chat/summarization
#[derive(Deserialize, Debug)]
pub struct OpenAIChatResponse {
    pub choices: Vec<OpenAIChoice>,
    pub usage: Option<OpenAIUsage>,
}

#[derive(Deserialize, Debug)]
pub struct OpenAIChoice {
    pub message: OpenAIResponseMessage,
    pub finish_reason: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct OpenAIResponseMessage {
    pub content: String,
}

#[derive(Deserialize, Debug)]
pub struct OpenAIUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Error types
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub enum NotetakerError {
    NotFound(String),
    Unauthorized(String),
    InvalidInput(String),
    ExternalCallError(String),
    ProcessingError(String),
    StorageError(String),
}

pub type NotetakerResult<T> = Result<T, NotetakerError>;

/// Implement Storable for Meeting to store in stable structures
impl Storable for Meeting {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap()
    }

    const BOUND: ic_stable_structures::storable::Bound = ic_stable_structures::storable::Bound::Bounded {
        max_size: 10_000_000, 
        is_fixed_size: false,
    };
}

/// Implement Storable for AudioChunk to store in stable structures
impl Storable for AudioChunk {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap()
    }

    const BOUND: ic_stable_structures::storable::Bound = ic_stable_structures::storable::Bound::Bounded {
        max_size: 5_000_000, 
        is_fixed_size: false,
    };
}


/// Helper functions
impl NotetakerError {
    pub fn to_string(&self) -> String {
        match self {
            NotetakerError::NotFound(msg) => format!("Not found: {}", msg),
            NotetakerError::Unauthorized(msg) => format!("Unauthorized: {}", msg),
            NotetakerError::InvalidInput(msg) => format!("Invalid input: {}", msg),
            NotetakerError::ExternalCallError(msg) => format!("External call error: {}", msg),
            NotetakerError::ProcessingError(msg) => format!("Processing error: {}", msg),
            NotetakerError::StorageError(msg) => format!("Storage error: {}", msg),
        }
    }
}

impl From<String> for NotetakerError {
    fn from(msg: String) -> Self {
        NotetakerError::ProcessingError(msg)
    }
}