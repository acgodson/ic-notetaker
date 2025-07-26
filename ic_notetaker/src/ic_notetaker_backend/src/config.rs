pub const MAX_AUDIO_CHUNK_SIZE: usize = 1024 * 1024; // 1MB max for ICP safety
pub const MAX_MEETING_DURATION: u64 = 24 * 60 * 60 * 1_000_000_000; 
pub const MAX_RETRY_COUNT: u32 = 3;

/// OpenAI proxy configuration  
pub const OPENAI_PROXY_BASE_URL: &str = "https://us-central1-blueband-db-442d8.cloudfunctions.net/proxy"; 

/// Audio transcription models 
pub const OPENAI_MODEL_TRANSCRIBE_DEFAULT: &str = "whisper-1"; 
pub const OPENAI_MODEL_TRANSCRIBE_MINI: &str = "gpt-4o-mini-transcribe"; 
pub const OPENAI_MODEL_WHISPER: &str = "whisper-1"; 

/// Chat completion models 
pub const OPENAI_MODEL_CHAT_DEFAULT: &str = "gpt-4.1"; 
pub const OPENAI_MODEL_CHAT_MINI: &str = "gpt-4.1-mini"; 
pub const OPENAI_MODEL_CHAT_NANO: &str = "gpt-4.1-nano"; 

// Alternative model 
pub const OPENAI_MODEL_O3_MINI: &str = "o3-mini";
pub const OPENAI_MODEL_GPT4O: &str = "gpt-4o"; 
pub const OPENAI_MODEL_GPT4O_MINI: &str = "gpt-4o-mini";

#[derive(Clone, Debug)]
pub struct Config {
    pub openai_api_key: Option<String>,
    pub max_concurrent_processing: u32,
    pub auto_cleanup_enabled: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            openai_api_key: Some("OPENAI_API_KEY".to_string()),
            max_concurrent_processing: 3,
            auto_cleanup_enabled: true,
        }
    }
}

thread_local! {
    static CONFIG: std::cell::RefCell<Config> = std::cell::RefCell::new(Config::default());
}

pub fn get_api_key() -> Option<String> {
    CONFIG.with(|config| config.borrow().openai_api_key.clone())
}

pub fn get_max_concurrent() -> u32 {
    CONFIG.with(|config| config.borrow().max_concurrent_processing)
}

pub fn get_auto_cleanup_enabled() -> bool {
    CONFIG.with(|config| config.borrow().auto_cleanup_enabled)
}

pub fn has_api_key() -> bool {
    CONFIG.with(|config| config.borrow().openai_api_key.is_some())
}