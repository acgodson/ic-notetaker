use ic_cdk::api::management_canister::http_request::{
    http_request, CanisterHttpRequestArgument, HttpHeader, HttpMethod, HttpResponse, TransformArgs,
    TransformContext, TransformFunc,
};
use ic_cdk_macros::query;
use base64::prelude::*;

use crate::types::{
    NotetakerError, NotetakerResult, OpenAIChatRequest, OpenAIChatResponse, OpenAIMessage,
    OpenAITranscriptionRequest, OpenAITranscriptionResponse, TranscriptSegment,
};
use crate::config::{
    OPENAI_PROXY_BASE_URL, 
    OPENAI_MODEL_TRANSCRIBE_DEFAULT, 
    OPENAI_MODEL_CHAT_DEFAULT
};

/// OpenAI API client for IC Notetaker
pub struct OpenAIClient;

impl OpenAIClient {
    /// Transcribe audio using default transcription model
    pub async fn transcribe_audio(
        audio_data: Vec<u8>,
        api_key: &str,
    ) -> NotetakerResult<Vec<TranscriptSegment>> {
        Self::transcribe_audio_with_model(audio_data, api_key, OPENAI_MODEL_TRANSCRIBE_DEFAULT).await
    }

    /// Transcribe audio with configurable model
    pub async fn transcribe_audio_with_model(
        audio_data: Vec<u8>,
        api_key: &str,
        model: &str,
    ) -> NotetakerResult<Vec<TranscriptSegment>> {
        Self::transcribe_audio_with_config(audio_data, api_key, OPENAI_PROXY_BASE_URL, model).await
    }

    /// Transcribe audio with full configuration (proxy + model)
    pub async fn transcribe_audio_with_config(
        audio_data: Vec<u8>,
        api_key: &str,
        proxy_base_url: &str,
        model: &str,
    ) -> NotetakerResult<Vec<TranscriptSegment>> {
        let base64_audio = base64::prelude::BASE64_STANDARD.encode(&audio_data);
        
        // Generate idempotency key for this request
        let idempotency_key = Self::generate_idempotency_key(&audio_data);

        // Create request with endpoint indicator for Firebase proxy
        let mut request_body = serde_json::json!({
            "endpoint": "/v1/audio/transcriptions",
            "file": base64_audio,
            "model": model.to_string(),
            "response_format": "verbose_json",
            "timestamp_granularities": ["segment"]
        });

        let body_json = serde_json::to_string(&request_body).map_err(|e| {
            NotetakerError::ProcessingError(format!("JSON serialization error: {}", e))
        })?;

        let cycles_needed = calculate_transcription_cycles(audio_data.len());
        let url = proxy_base_url.to_string();

        let request = CanisterHttpRequestArgument {
            url,
            method: HttpMethod::POST,
            body: Some(body_json.into_bytes()),
            max_response_bytes: Some(2_000_000),
            transform: Some(TransformContext {
                function: TransformFunc(candid::Func {
                    principal: ic_cdk::api::id(),
                    method: "transform_openai_response".to_string(),
                }),
                context: vec![],
            }),
            headers: vec![
                HttpHeader {
                    name: "Content-Type".to_string(),
                    value: "application/json".to_string(),
                },
                HttpHeader {
                    name: "Authorization".to_string(),
                    value: format!("Bearer {}", api_key),
                },
                HttpHeader {
                    name: "Idempotency-Key".to_string(),
                    value: idempotency_key,
                },
                HttpHeader {
                    name: "User-Agent".to_string(),
                    value: "IC-Notetaker/1.0".to_string(),
                },
            ],
        };

        match http_request(request, cycles_needed).await {
            Ok((response,)) => {
                let status = response.status.to_string().parse::<u32>().unwrap_or(0);
                if !(200..300).contains(&status) {
                    return Err(NotetakerError::ExternalCallError(format!(
                        "OpenAI API error {}: {}",
                        response.status,
                        String::from_utf8_lossy(&response.body)
                    )));
                }

                let response_text = String::from_utf8(response.body).map_err(|e| {
                    NotetakerError::ExternalCallError(format!("Invalid UTF-8 response: {}", e))
                })?;

                let openai_response: OpenAITranscriptionResponse =
                    serde_json::from_str(&response_text).map_err(|e| {
                        NotetakerError::ExternalCallError(format!("JSON parse error: {}", e))
                    })?;

                // Convert OpenAI segments to our TranscriptSegment format
                let segments = if let Some(openai_segments) = openai_response.segments {
                    openai_segments
                        .into_iter()
                        .enumerate()
                        .map(|(i, segment)| TranscriptSegment {
                            chunk_id: format!("segment_{}", i),
                            text: segment.text.trim().to_string(),
                            timestamp: (segment.start * 1_000_000_000.0) as u64,
                            confidence: None, // NOTE: OpenAI doesn't provide confidence scores
                        })
                        .filter(|s| !s.text.is_empty())
                        .collect()
                } else {
                    // Fallback: create single segment from text
                    vec![TranscriptSegment {
                        chunk_id: "segment_0".to_string(),
                        text: openai_response.text.trim().to_string(),
                        timestamp: ic_cdk::api::time(),
                        confidence: None,
                    }]
                };

                ic_cdk::println!(
                    "Successfully transcribed audio: {} segments",
                    segments.len()
                );
                Ok(segments)
            }
            Err((rejection_code, message)) => {
                if message.contains("cycles") || message.contains("OutOfCycles") {
                    Err(NotetakerError::ExternalCallError(format!(
                        "Insufficient cycles: sent {} cycles but need more. Error: {}",
                        cycles_needed, message
                    )))
                } else if message.contains("SysTransient") || message.contains("timeout") {
                    Err(NotetakerError::ExternalCallError(format!(
                        "Network error (consider retry): {:?} - {}",
                        rejection_code, message
                    )))
                } else {
                    Err(NotetakerError::ExternalCallError(format!(
                        "HTTP request failed: {:?} - {}",
                        rejection_code, message
                    )))
                }
            }
        }
    }

    /// Generate meeting summary using OpenAI Chat API
    pub async fn generate_summary(
        transcript_segments: &[TranscriptSegment],
        meeting_title: Option<&str>,
        api_key: &str,
    ) -> NotetakerResult<String> {
        Self::generate_summary_with_proxy(transcript_segments, meeting_title, api_key, OPENAI_PROXY_BASE_URL).await
    }

    /// Generate meeting summary with configurable proxy URL
    pub async fn generate_summary_with_proxy(
        transcript_segments: &[TranscriptSegment],
        meeting_title: Option<&str>,
        api_key: &str,
        proxy_base_url: &str,
    ) -> NotetakerResult<String> {
        if transcript_segments.is_empty() {
            return Err(NotetakerError::InvalidInput(
                "No transcript segments provided".to_string(),
            ));
        }

        // Combine all transcript segments into context
        let full_transcript = transcript_segments
            .iter()
            .map(|segment| segment.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        if full_transcript.trim().is_empty() {
            return Err(NotetakerError::InvalidInput(
                "Empty transcript provided".to_string(),
            ));
        }

        // Create the summarization prompt
        let title_context = meeting_title
            .map(|t| format!("Meeting title: {}\n\n", t))
            .unwrap_or_default();

        let system_prompt = format!(
            "You are an AI assistant specialized in creating concise, structured meeting summaries. \
            Analyze the following meeting transcript and provide a comprehensive summary that includes:\n\
            1. Key discussion points\n\
            2. Decisions made\n\
            3. Action items (if any)\n\
            4. Important insights or conclusions\n\n\
            Be concise but thorough, and organize the information clearly."
        );

        let user_prompt = format!(
            "{}Please summarize this meeting transcript:\n\n{}",
            title_context, full_transcript
        );

        // Generate idempotency key based on content
        let content_hash = format!("{:?}{:?}", transcript_segments, meeting_title);
        let idempotency_key = Self::generate_idempotency_key(content_hash.as_bytes());

        // Create request with endpoint indicator for Firebase proxy
        let request_body = serde_json::json!({
            "endpoint": "/v1/chat/completions",
            "model": OPENAI_MODEL_CHAT_DEFAULT,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user", 
                    "content": user_prompt
                }
            ],
            "max_tokens": 1000,
            "temperature": 0.3
        });

        let body_json = serde_json::to_string(&request_body).map_err(|e| {
            NotetakerError::ProcessingError(format!("JSON serialization error: {}", e))
        })?;

        let cycles_needed = calculate_chat_cycles(body_json.len());
        let url = proxy_base_url.to_string();

        let request = CanisterHttpRequestArgument {
            url,
            method: HttpMethod::POST,
            body: Some(body_json.into_bytes()),
            max_response_bytes: Some(1_000_000),
            transform: Some(TransformContext {
                function: TransformFunc(candid::Func {
                    principal: ic_cdk::api::id(),
                    method: "transform_openai_response".to_string(),
                }),
                context: vec![],
            }),
            headers: vec![
                HttpHeader {
                    name: "Content-Type".to_string(),
                    value: "application/json".to_string(),
                },
                HttpHeader {
                    name: "Authorization".to_string(),
                    value: format!("Bearer {}", api_key),
                },
                HttpHeader {
                    name: "Idempotency-Key".to_string(),
                    value: idempotency_key,
                },
                HttpHeader {
                    name: "User-Agent".to_string(),
                    value: "IC-Notetaker/1.0".to_string(),
                },
            ],
        };

        match http_request(request, cycles_needed).await {
            Ok((response,)) => {
                let status = response.status.to_string().parse::<u32>().unwrap_or(0);
                if !(200..300).contains(&status) {
                    return Err(NotetakerError::ExternalCallError(format!(
                        "OpenAI API error {}: {}",
                        response.status,
                        String::from_utf8_lossy(&response.body)
                    )));
                }

                let response_text = String::from_utf8(response.body).map_err(|e| {
                    NotetakerError::ExternalCallError(format!("Invalid UTF-8 response: {}", e))
                })?;

                let openai_response: OpenAIChatResponse = serde_json::from_str(&response_text)
                    .map_err(|e| {
                        NotetakerError::ExternalCallError(format!("JSON parse error: {}", e))
                    })?;

                if openai_response.choices.is_empty() {
                    return Err(NotetakerError::ExternalCallError(
                        "No choices in OpenAI response".to_string(),
                    ));
                }

                let summary = openai_response.choices[0]
                    .message
                    .content
                    .trim()
                    .to_string();

                if summary.is_empty() {
                    return Err(NotetakerError::ExternalCallError(
                        "Empty summary from OpenAI".to_string(),
                    ));
                }

                ic_cdk::println!(
                    "Successfully generated summary: {} characters",
                    summary.len()
                );
                Ok(summary)
            }
            Err((rejection_code, message)) => {
                if message.contains("cycles") || message.contains("OutOfCycles") {
                    Err(NotetakerError::ExternalCallError(format!(
                        "Insufficient cycles: sent {} cycles but need more. Error: {}",
                        cycles_needed, message
                    )))
                } else if message.contains("SysTransient") || message.contains("timeout") {
                    Err(NotetakerError::ExternalCallError(format!(
                        "Network error (consider retry): {:?} - {}",
                        rejection_code, message
                    )))
                } else {
                    Err(NotetakerError::ExternalCallError(format!(
                        "HTTP request failed: {:?} - {}",
                        rejection_code, message
                    )))
                }
            }
        }
    }

    /// Generate deterministic idempotency key from content
    fn generate_idempotency_key(content: &[u8]) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        let hash = hasher.finish();
        format!(
            "{:08x}-{:04x}-{:04x}-{:04x}-{:012x}",
            (hash >> 32) & 0xffffffff,
            (hash >> 16) & 0xffff,
            hash & 0xffff,
            (hash >> 48) & 0xffff,
            hash & 0xffffffffffff
        )
    }
}


fn calculate_transcription_cycles(audio_size: usize) -> u128 {
    let n = 13u128;
    let base_fee = (3_000_000 + 60_000 * n) * n;

    let request_size = audio_size + 1000; // Audio + headers + metadata
    let request_fee = 400 * n * request_size as u128;
    let response_size = 100_000; 
    let response_fee = 800 * n * response_size;

    let total_calculated = base_fee + request_fee + response_fee;
    let with_buffer = (total_calculated as f64 * 5.0) as u128;
    with_buffer.max(25_000_000_000)
}


fn calculate_chat_cycles(request_size: usize) -> u128 {
    let n = 13u128;
    let base_fee = (3_000_000 + 60_000 * n) * n;

    let request_fee = 400 * n * request_size as u128;
    let response_size = 50_000; // 50KB for summary response
    let response_fee = 800 * n * response_size;

    let total_calculated = base_fee + request_fee + response_fee;
    let with_buffer = (total_calculated as f64 * 3.0) as u128;
    with_buffer.max(5_000_000_000)
}


#[query]
fn transform_openai_response(args: TransformArgs) -> HttpResponse {
    let mut response = args.response;

    response.headers.retain(|header| {
        let name_lower = header.name.to_lowercase();

        matches!(name_lower.as_str(), 
            "content-type" | 
            "content-length" |
            "content-encoding"
        )
    });


    if response.status != 200u16 {
        if let Ok(error_text) = String::from_utf8(response.body.clone()) {
            if error_text.contains("error") {
                let cleaned_error = error_text
                    .lines()
                    .filter(|line| !line.contains("timestamp") && !line.contains("request_id"))
                    .collect::<Vec<_>>()
                    .join("\n");
                response.body = cleaned_error.into_bytes();
            }
        }
    }

    response
}

