use candid::Principal;
use crate::types::{MeetingId, ChunkId, Meeting, MeetingSummary};

pub fn generate_meeting_id(caller: &Principal, timestamp: u64) -> MeetingId {
    format!(
        "meeting_{}_{}",
        hex::encode(&caller.as_slice()[..8]),
        timestamp
    )
}

pub fn generate_chunk_id(meeting_id: &MeetingId, timestamp: u64) -> ChunkId {
    format!("chunk_{}_{}_{}", meeting_id, timestamp, (timestamp % 10000))
}

pub fn meeting_to_summary(meeting: &Meeting) -> MeetingSummary {
    MeetingSummary {
        meeting_id: meeting.meeting_id.clone(),
        title: meeting.title.clone(),
        status: meeting.status.clone(),
        created_at: meeting.created_at,
        ended_at: meeting.ended_at,
        segment_count: meeting.transcript_segments.len() as u32,
        has_summary: meeting.summary.is_some(),
    }
}

