use ic_stable_structures::{
    memory_manager::{MemoryManager, MemoryId},
    DefaultMemoryImpl, StableBTreeMap,
};
use std::cell::RefCell;

use crate::types::{AudioChunk, ChunkId, Meeting, MeetingId};

const MEETINGS_MEMORY_ID: MemoryId = MemoryId::new(0);
const AUDIO_QUEUE_MEMORY_ID: MemoryId = MemoryId::new(1);

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );
}

fn get_meetings_memory() -> ic_stable_structures::memory_manager::VirtualMemory<DefaultMemoryImpl> {
    MEMORY_MANAGER.with(|m| m.borrow().get(MEETINGS_MEMORY_ID))
}

fn get_audio_queue_memory() -> ic_stable_structures::memory_manager::VirtualMemory<DefaultMemoryImpl> {
    MEMORY_MANAGER.with(|m| m.borrow().get(AUDIO_QUEUE_MEMORY_ID))
}

thread_local! {
    static MEETINGS: RefCell<StableBTreeMap<MeetingId, Meeting, ic_stable_structures::memory_manager::VirtualMemory<DefaultMemoryImpl>>> = 
        RefCell::new(StableBTreeMap::init(get_meetings_memory()));
}

thread_local! {
    static AUDIO_QUEUE: RefCell<StableBTreeMap<ChunkId, AudioChunk, ic_stable_structures::memory_manager::VirtualMemory<DefaultMemoryImpl>>> = 
        RefCell::new(StableBTreeMap::init(get_audio_queue_memory()));
}

pub struct Storage;

impl Storage {
    /// Store a new meeting
    pub fn store_meeting(meeting: Meeting) -> Result<(), String> {
        MEETINGS.with(|meetings| {
            meetings.borrow_mut().insert(meeting.meeting_id.clone(), meeting);
            Ok(())
        })
    }

    /// Get a meeting by ID
    pub fn get_meeting(meeting_id: &MeetingId) -> Option<Meeting> {
        MEETINGS.with(|meetings| {
            meetings.borrow().get(meeting_id)
        })
    }

    /// Update an existing meeting
    pub fn update_meeting(meeting: Meeting) -> Result<(), String> {
        MEETINGS.with(|meetings| {
            let mut map = meetings.borrow_mut();
            if map.get(&meeting.meeting_id).is_some() {
                map.insert(meeting.meeting_id.clone(), meeting);
                Ok(())
            } else {
                Err("Meeting not found".to_string())
            }
        })
    }


    /// Get all meetings for a principal (caller)
    pub fn get_user_meetings(owner: &candid::Principal) -> Vec<Meeting> {
        MEETINGS.with(|meetings| {
            meetings.borrow()
                .iter()
                .filter_map(|(_, meeting)| {
                    if meeting.owner == *owner {
                        Some(meeting)
                    } else {
                        None
                    }
                })
                .collect()
        })
    }

    /// Get meetings with pagination
    pub fn get_meetings_paginated(
        owner: &candid::Principal, 
        offset: usize, 
        limit: usize
    ) -> Vec<Meeting> {
        let mut meetings = Self::get_user_meetings(owner);
        
        meetings.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        
        meetings.into_iter()
            .skip(offset)
            .take(limit)
            .collect()
    }

    /// Add audio chunk to processing queue
    pub fn enqueue_audio_chunk(chunk: AudioChunk) -> Result<(), String> {
        AUDIO_QUEUE.with(|queue| {
            queue.borrow_mut().insert(chunk.chunk_id.clone(), chunk);
            Ok(())
        })
    }

    /// Update audio chunk in queue
    pub fn update_audio_chunk(chunk: AudioChunk) -> Result<(), String> {
        AUDIO_QUEUE.with(|queue| {
            let mut map = queue.borrow_mut();
            if map.get(&chunk.chunk_id).is_some() {
                map.insert(chunk.chunk_id.clone(), chunk);
                Ok(())
            } else {
                Err("Audio chunk not found".to_string())
            }
        })
    }

    /// Remove audio chunk from queue (after processing)
    pub fn dequeue_audio_chunk(chunk_id: &ChunkId) -> Result<AudioChunk, String> {
        AUDIO_QUEUE.with(|queue| {
            let mut map = queue.borrow_mut();
            map.remove(chunk_id).ok_or_else(|| "Audio chunk not found".to_string())
        })
    }

    /// Get all queued audio chunks for a meeting
    pub fn get_meeting_audio_queue(meeting_id: &MeetingId) -> Vec<AudioChunk> {
        AUDIO_QUEUE.with(|queue| {
            queue.borrow()
                .iter()
                .filter_map(|(_, chunk)| {
                    if chunk.meeting_id == *meeting_id {
                        Some(chunk)
                    } else {
                        None
                    }
                })
                .collect()
        })
    }

    /// Get all queued chunks (for processing)
    pub fn get_all_queued_chunks() -> Vec<AudioChunk> {
        AUDIO_QUEUE.with(|queue| {
            queue.borrow()
                .iter()
                .map(|(_, chunk)| chunk)
                .collect()
        })
    }

    /// Get queue statistics
    pub fn get_queue_stats() -> (u64, u64, u64) {
        AUDIO_QUEUE.with(|queue| {
            let map = queue.borrow();
            let total = map.len();
            let (queued, processing) = map.iter().fold((0u64, 0u64), |(q, p), (_, chunk)| {
                match chunk.status {
                    crate::types::ProcessingStatus::Queued => (q + 1, p),
                    crate::types::ProcessingStatus::Processing => (q, p + 1),
                    _ => (q, p),
                }
            });
            (total, queued, processing)
        })
    }

    /// Clean up old completed chunks (to save memory)
    pub fn cleanup_processed_chunks(cutoff_time: u64) -> u32 {
        let mut cleaned = 0u32;
        
        AUDIO_QUEUE.with(|queue| {
            let mut map = queue.borrow_mut();
            let keys_to_remove: Vec<ChunkId> = map.iter()
                .filter_map(|(chunk_id, chunk)| {
                    if matches!(chunk.status, crate::types::ProcessingStatus::Completed | crate::types::ProcessingStatus::Failed(_)) 
                       && chunk.timestamp < cutoff_time {
                        Some(chunk_id)
                    } else {
                        None
                    }
                })
                .collect();
            
            for chunk_id in keys_to_remove {
                map.remove(&chunk_id);
                cleaned += 1;
            }
        });
        
        cleaned
    }

    /// Get storage statistics
    pub fn get_storage_stats() -> (u64, u64) {
        let meetings_count = MEETINGS.with(|meetings| meetings.borrow().len());
        let queue_count = AUDIO_QUEUE.with(|queue| queue.borrow().len());
        (meetings_count, queue_count)
    }
}