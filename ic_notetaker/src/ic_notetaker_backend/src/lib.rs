use ic_cdk::api::time;
use ic_cdk::api::management_canister::http_request::{TransformArgs, HttpResponse};
use ic_cdk_macros::{query, update};
use std::collections::HashMap;

mod admin;
mod config;
mod external;
mod processing;
mod storage;
mod types;
mod utils;

use config::*;
use processing::*;
use storage::Storage;
use types::*;
use utils::{generate_meeting_id, generate_chunk_id, meeting_to_summary};

#[update]
fn start_meeting(request: StartMeetingRequest) -> Result<StartMeetingResponse, String> {
    let caller = ic_cdk::caller();
    let now = time();
    let meeting_id = generate_meeting_id(&caller, now);

    let meeting = Meeting {
        meeting_id: meeting_id.clone(),
        owner: caller,
        title: request.title.clone(),
        status: MeetingStatus::Active,
        created_at: now,
        ended_at: None,
        last_activity: now,
        transcript_segments: Vec::new(),
        summary: None,
    };

    Storage::store_meeting(meeting).map_err(|e| format!("Failed to store meeting: {}", e))?;

    Ok(StartMeetingResponse {
        meeting_id,
        status: "Meeting started successfully".to_string(),
    })
}

#[update]
fn add_audio(request: AddAudioRequest) -> Result<AddAudioResponse, String> {
    let caller = ic_cdk::caller();
    let now = time();

    let mut meeting = Storage::get_meeting(&request.meeting_id).ok_or("Meeting not found")?;

    if meeting.owner != caller {
        return Err("Unauthorized: You are not the meeting owner".to_string());
    }

    if meeting.status != MeetingStatus::Active {
        return Err("Meeting is not active".to_string());
    }

    if request.audio_data.is_empty() {
        return Err("Empty audio data".to_string());
    }

    let chunk_id = generate_chunk_id(&request.meeting_id, now);

    let audio_chunk = AudioChunk {
        chunk_id: chunk_id.clone(),
        meeting_id: request.meeting_id.clone(),
        audio_data: request.audio_data,
        timestamp: request.timestamp.unwrap_or(now),
        status: ProcessingStatus::Queued,
        retry_count: 0,
    };

    Storage::enqueue_audio_chunk(audio_chunk)
        .map_err(|e| format!("Failed to enqueue audio: {}", e))?;

    meeting.last_activity = now;
    Storage::update_meeting(meeting).map_err(|e| format!("Failed to update meeting: {}", e))?;

    let queue_size = Storage::get_meeting_audio_queue(&request.meeting_id).len() as u32;

    if let Some(api_key) = get_api_key() {
        let max_concurrent = get_max_concurrent();
        ic_cdk::println!("Spawning audio processing task...");
        ic_cdk::spawn(async move {
            ic_cdk::println!("Audio processing task started");
            process_audio_queue(&api_key, max_concurrent).await;
            ic_cdk::println!("Audio processing task completed");
        });
    } else {
        ic_cdk::println!("No API key configured, skipping audio processing");
    }

    Ok(AddAudioResponse {
        chunk_id,
        status: "Audio added to processing queue".to_string(),
        queue_size,
    })
}

#[update]
async fn end_meeting(request: EndMeetingRequest) -> Result<EndMeetingResponse, String> {
    let caller = ic_cdk::caller();
    let now = time();

    let mut meeting = Storage::get_meeting(&request.meeting_id).ok_or("Meeting not found")?;

    if meeting.owner != caller {
        return Err("Unauthorized: You are not the meeting owner".to_string());
    }

    if meeting.status != MeetingStatus::Active {
        return Err("Meeting is not active".to_string());
    }

    let pending_chunks = Storage::get_meeting_audio_queue(&request.meeting_id);
    if !pending_chunks.is_empty() {
        if let Some(api_key) = get_api_key() {
            for chunk in pending_chunks {
                if let ProcessingStatus::Queued = chunk.status {
                    let _ = process_single_audio_chunk(chunk, &api_key).await;
                }
            }
        }

        meeting = Storage::get_meeting(&request.meeting_id)
            .ok_or("Meeting not found after processing")?;
    }

    let summary = if !meeting.transcript_segments.is_empty() {
        if let Some(api_key) = get_api_key() {
            generate_meeting_summary(&meeting, &api_key).await.ok()
        } else {
            None
        }
    } else {
        None
    };

    meeting.status = MeetingStatus::Ended;
    meeting.ended_at = Some(now);
    meeting.summary = summary.clone();

    Storage::update_meeting(meeting.clone())
        .map_err(|e| format!("Failed to update meeting: {}", e))?;

    Ok(EndMeetingResponse {
        meeting_id: request.meeting_id,
        status: "Meeting ended successfully".to_string(),
        summary,
        total_segments: meeting.transcript_segments.len() as u32,
    })
}

#[query]
fn get_meeting(meeting_id: MeetingId) -> Result<Meeting, String> {
    let caller = ic_cdk::caller();
    let meeting = Storage::get_meeting(&meeting_id).ok_or("Meeting not found")?;

    if meeting.owner != caller {
        return Err("Unauthorized: You are not the meeting owner".to_string());
    }

    Ok(meeting)
}

#[query]
fn get_meetings(offset: Option<u32>, limit: Option<u32>) -> Vec<MeetingSummary> {
    let caller = ic_cdk::caller();
    let offset = offset.unwrap_or(0) as usize;
    let limit = limit.unwrap_or(10).min(50) as usize;
    let meetings = Storage::get_meetings_paginated(&caller, offset, limit);

    meetings
        .iter()
        .map(meeting_to_summary)
        .collect()
}

#[query]
fn get_queue_stats() -> (u64, u64, u64) {
    admin::get_queue_stats()
}

#[query]
fn get_storage_stats() -> (u64, u64) {
    admin::get_storage_stats()
}

#[update]
fn cleanup_old_data() -> String {
    admin::cleanup_old_data()
}

#[update]
async fn periodic_maintenance() -> String {
    let api_key = get_api_key().unwrap_or_default();
    admin::periodic_maintenance(&api_key, get_max_concurrent(), get_auto_cleanup_enabled()).await
}

#[query]
fn health_check() -> HashMap<String, String> {
    admin::health_check(has_api_key())
}


// Export candid interface
ic_cdk::export_candid!();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      