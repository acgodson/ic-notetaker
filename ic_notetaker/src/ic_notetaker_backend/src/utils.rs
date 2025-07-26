use candid::Principal;
use crate::types::{MeetingId, ChunkId, Meeting, MeetingSummary};

pub fn generate_meeting_id(caller: &Principal, timestamp: u64) -> MeetingId {
    let caller_bytes = caller.as_slice();
    let bytes_to_use = if caller_bytes.len() >= 8 {
        caller_bytes[..8].to_vec()
    } else {
        // Pad with zeros if principal is shorter than 8 bytes
        let mut padded = vec![0u8; 8];
        padded[..caller_bytes.len()].copy_from_slice(caller_bytes);
        padded
    };
    
    format!(
        "meeting_{}_{}",
        hex::encode(bytes_to_use),
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

