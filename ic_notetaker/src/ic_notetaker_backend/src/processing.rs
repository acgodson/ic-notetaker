use ic_cdk::spawn;
use crate::external::OpenAIClient;
use crate::storage::Storage;
use crate::types::*;
use crate::config::*;

pub async fn process_audio_queue(api_key: &str, max_concurrent: u32) {
    let mut processed = 0u32;
    let queued_chunks = Storage::get_all_queued_chunks();

    for chunk in queued_chunks {
        if processed >= max_concurrent {
            break;
        }

        if let ProcessingStatus::Queued = chunk.status {
            // Process directly instead of spawning nested tasks
            ic_cdk::println!("Processing audio chunk: {}", chunk.chunk_id);
            let _ = process_single_audio_chunk(chunk, api_key).await;
            processed += 1;
        }
    }

    if processed > 0 {
        ic_cdk::println!("Processed {} audio chunks", processed);
    }
}

pub async fn process_single_audio_chunk(mut chunk: AudioChunk, api_key: &str) -> Result<(), String> {
    ic_cdk::println!("Starting to process chunk: {} (size: {} bytes)", chunk.chunk_id, chunk.audio_data.len());
    
    chunk.status = ProcessingStatus::Processing;
    Storage::update_audio_chunk(chunk.clone())
        .map_err(|e| format!("Failed to update chunk status: {}", e))?;

    ic_cdk::println!("Making transcription request for chunk: {}", chunk.chunk_id);
    
    // Smart chunking: if audio is too large, split it for processing
    let segments_result = if chunk.audio_data.len() > MAX_AUDIO_CHUNK_SIZE {
        ic_cdk::println!("Audio too large, processing in chunks");
        process_large_audio_chunk(chunk.audio_data.clone(), api_key).await
    } else {
        ic_cdk::println!("Processing audio with OpenAI transcription");
        OpenAIClient::transcribe_audio(chunk.audio_data.clone(), api_key).await.map_err(|e| e.to_string())
    };

    match segments_result {
        Ok(segments) => {
            // Add segments to meeting
            if let Some(mut meeting) = Storage::get_meeting(&chunk.meeting_id) {
                for segment in segments {
                    meeting.transcript_segments.push(segment);
                }

                if let Err(e) = Storage::update_meeting(meeting) {
                    ic_cdk::println!("Failed to update meeting with transcript: {}", e);
                }
            }

            let _ = Storage::dequeue_audio_chunk(&chunk.chunk_id);
            ic_cdk::println!("Successfully processed audio chunk: {}", chunk.chunk_id);
            Ok(())
        }
        Err(e) => {
            chunk.retry_count += 1;

            if chunk.retry_count >= MAX_RETRY_COUNT {
                chunk.status = ProcessingStatus::Failed(e.clone());
                ic_cdk::println!(
                    "Failed to process chunk {} after {} retries: {}",
                    chunk.chunk_id,
                    chunk.retry_count,
                    e
                );
            } else {
                chunk.status = ProcessingStatus::Queued;
                ic_cdk::println!(
                    "Retrying chunk {} (attempt {}): {}",
                    chunk.chunk_id,
                    chunk.retry_count + 1,
                    e
                );
            }

            Storage::update_audio_chunk(chunk)
                .map_err(|e| format!("Failed to update chunk: {}", e))?;

            Err(e)
        }
    }
}

async fn process_large_audio_chunk(audio_data: Vec<u8>, api_key: &str) -> Result<Vec<TranscriptSegment>, String> {
    let chunk_size = MAX_AUDIO_CHUNK_SIZE;
    let mut all_segments = Vec::new();
    
    for (i, chunk) in audio_data.chunks(chunk_size).enumerate() {
        ic_cdk::println!("Processing sub-chunk {} of large audio", i + 1);
        
        match OpenAIClient::transcribe_audio(chunk.to_vec(), api_key).await {
            Ok(mut segments) => {
                // Adjust timestamps for sub-chunk position
                let time_offset = (i as f32) * 10.0 * 1_000_000_000.0; // Assume 10s per chunk
                for segment in &mut segments {
                    segment.timestamp = segment.timestamp.saturating_add(time_offset as u64);
                }
                all_segments.extend(segments);
            }
            Err(e) => {
                ic_cdk::println!("Failed to process sub-chunk {}: {}", i + 1, e.to_string());
                return Err(format!("Sub-chunk {} failed: {}", i + 1, e.to_string()));
            }
        }
    }
    
    Ok(all_segments)
}

pub async fn generate_meeting_summary(meeting: &Meeting, api_key: &str) -> Result<String, String> {
    OpenAIClient::generate_summary(
        &meeting.transcript_segments,
        meeting.title.as_deref(),
        api_key,
    )
    .await
    .map_err(|e| e.to_string())
}