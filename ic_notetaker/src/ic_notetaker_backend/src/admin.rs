use ic_cdk::api::time;
use std::collections::HashMap;
use crate::storage::Storage;
use crate::types::*;
use crate::config::MAX_MEETING_DURATION;
use crate::processing::{process_audio_queue, generate_meeting_summary};

pub fn get_queue_stats() -> (u64, u64, u64) {
    Storage::get_queue_stats()
}

pub fn get_storage_stats() -> (u64, u64) {
    Storage::get_storage_stats()
}

pub fn cleanup_old_data() -> String {
    let cutoff_time = time() - (7 * 24 * 60 * 60 * 1_000_000_000);
    let cleaned_chunks = Storage::cleanup_processed_chunks(cutoff_time);
    format!("Cleaned up {} old audio chunks", cleaned_chunks)
}

pub async fn auto_end_inactive_meetings(api_key: &str) -> u32 {
    let now = time();
    let cutoff_time = now - MAX_MEETING_DURATION;
    let mut ended_count = 0u32;

    let all_meetings = Storage::get_user_meetings(&ic_cdk::caller());

    for mut meeting in all_meetings {
        if meeting.status == MeetingStatus::Active && meeting.last_activity < cutoff_time {
            meeting.status = MeetingStatus::AutoEnded;
            meeting.ended_at = Some(now);

            if !meeting.transcript_segments.is_empty() {
                if let Ok(summary) = generate_meeting_summary(&meeting, api_key).await {
                    meeting.summary = Some(summary);
                }
            }

            if Storage::update_meeting(meeting).is_ok() {
                ended_count += 1;
            }
        }
    }

    ic_cdk::println!("Auto-ended {} inactive meetings", ended_count);
    ended_count
}

pub async fn periodic_maintenance(api_key: &str, max_concurrent: u32, auto_cleanup_enabled: bool) -> String {
    let mut results = Vec::new();

    let ended_meetings = auto_end_inactive_meetings(api_key).await;
    if ended_meetings > 0 {
        results.push(format!("Auto-ended {} meetings", ended_meetings));
    }

    if auto_cleanup_enabled {
        let cleanup_result = cleanup_old_data();
        results.push(cleanup_result);
    }

    process_audio_queue(api_key, max_concurrent).await;
    results.push("Processed audio queue".to_string());

    if results.is_empty() {
        "No maintenance tasks performed".to_string()
    } else {
        results.join("; ")
    }
}

pub fn health_check(has_api_key: bool) -> HashMap<String, String> {
    let mut status = HashMap::new();

    let (total_meetings, total_chunks) = Storage::get_storage_stats();
    let (queue_total, queue_queued, queue_processing) = Storage::get_queue_stats();

    status.insert("status".to_string(), "healthy".to_string());
    status.insert("total_meetings".to_string(), total_meetings.to_string());
    status.insert("total_chunks".to_string(), total_chunks.to_string());
    status.insert("queue_total".to_string(), queue_total.to_string());
    status.insert("queue_queued".to_string(), queue_queued.to_string());
    status.insert("queue_processing".to_string(), queue_processing.to_string());
    status.insert("openai_configured".to_string(), has_api_key.to_string());
    status.insert("timestamp".to_string(), time().to_string());

    status
}