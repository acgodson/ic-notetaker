import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

interface StartMeetingRequest {
  title: [string] | [];
}

interface StartMeetingResponse {
  meeting_id: string;
  status: string;
}

interface AddAudioRequest {
  meeting_id: string;
  audio_data: number[];
  timestamp: [bigint] | []; 
}

interface AddAudioResponse {
  chunk_id: string;
  status: string;
  queue_size: number;
}

interface EndMeetingRequest {
  meeting_id: string;
}

interface EndMeetingResponse {
  meeting_id: string;
  status: string;
  summary?: string;
  total_segments: number;
}

interface Meeting {
  meeting_id: string;
  owner: Principal;
  title?: string;
  status: { Active?: null; Ended?: null; AutoEnded?: null };
  created_at: bigint;
  ended_at?: bigint;
  last_activity: bigint;
  transcript_segments: Array<{
    chunk_id: string;
    text: string;
    timestamp: bigint;
    confidence?: number;
  }>;
  summary?: string;
}

interface TestResult<T> {
  Ok?: T;
  Err?: string;
}


const idlFactory = ({ IDL }: any) => {
  const MeetingId = IDL.Text;
  const StartMeetingRequest = IDL.Record({ title: IDL.Opt(IDL.Text) });
  const StartMeetingResponse = IDL.Record({
    meeting_id: MeetingId,
    status: IDL.Text,
  });
  
  const AddAudioRequest = IDL.Record({
    meeting_id: MeetingId,
    audio_data: IDL.Vec(IDL.Nat8),
    timestamp: IDL.Opt(IDL.Nat64),
  });
  
  const AddAudioResponse = IDL.Record({
    chunk_id: IDL.Text,
    status: IDL.Text,
    queue_size: IDL.Nat32,
  });
  
  const EndMeetingRequest = IDL.Record({ meeting_id: MeetingId });
  const EndMeetingResponse = IDL.Record({
    meeting_id: MeetingId,
    status: IDL.Text,
    summary: IDL.Opt(IDL.Text),
    total_segments: IDL.Nat32,
  });

  const MeetingStatus = IDL.Variant({
    Active: IDL.Null,
    Ended: IDL.Null,
    AutoEnded: IDL.Null,
  });

  const TranscriptSegment = IDL.Record({
    chunk_id: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Nat64,
    confidence: IDL.Opt(IDL.Float32),
  });

  const Meeting = IDL.Record({
    meeting_id: MeetingId,
    owner: IDL.Principal,
    title: IDL.Opt(IDL.Text),
    status: MeetingStatus,
    created_at: IDL.Nat64,
    ended_at: IDL.Opt(IDL.Nat64),
    last_activity: IDL.Nat64,
    transcript_segments: IDL.Vec(TranscriptSegment),
    summary: IDL.Opt(IDL.Text),
  });

  return IDL.Service({
    start_meeting: IDL.Func(
      [StartMeetingRequest],
      [IDL.Variant({ Ok: StartMeetingResponse, Err: IDL.Text })],
      []
    ),
    add_audio: IDL.Func(
      [AddAudioRequest],
      [IDL.Variant({ Ok: AddAudioResponse, Err: IDL.Text })],
      []
    ),
    end_meeting: IDL.Func(
      [EndMeetingRequest],
      [IDL.Variant({ Ok: EndMeetingResponse, Err: IDL.Text })],
      []
    ),
    get_meeting: IDL.Func(
      [MeetingId],
      [IDL.Variant({ Ok: Meeting, Err: IDL.Text })],
      ["query"]
    ),
    health_check: IDL.Func(
      [],
      [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))],
      ["query"]
    ),
  });
};

class NotetakerTest {
  private agent: HttpAgent;
  private actor: any;
  private audioData: number[];

  constructor() {
    // Create agent with identity
    const identity = Ed25519KeyIdentity.generate();

    this.agent = new HttpAgent({
      host: process.env.HOST || "http://127.0.0.1:4943",
      identity,
    });

    // Fetch root key for local replica
    this.agent.fetchRootKey().catch(console.error);

    this.actor = Actor.createActor(idlFactory, {
      agent: this.agent,
      canisterId: Principal.fromText(
        process.env.CANISTER_ID_IC_NOTETAKER_BACKEND || "rdmx6-jaaaa-aaaaa-aaadq-cai"
      ),
    });

    // Load test audio file
    this.loadTestAudio();
  }

  private loadTestAudio() {
    try {
      const audioPath = path.join(process.cwd(), "test_voice.m4a");
      const audioBuffer = fs.readFileSync(audioPath);
      this.audioData = Array.from(audioBuffer);
      console.log(`📁 Loaded test audio: ${this.audioData.length} bytes`);
    } catch (error) {
      console.error("❌ Failed to load test audio file:", error);
      process.exit(1);
    }
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testHealthCheck() {
    console.log("🏥 Testing health check...");
    try {
      const result = await this.actor.health_check();
      console.log("✅ Health check passed");
      return true;
    } catch (error) {
      console.error("❌ Health check failed:", error);
      return false;
    }
  }

  async testStartMeeting() {
    console.log("🚀 Starting test meeting...");
    const request: StartMeetingRequest = {
      title: ["Test Meeting - Voice Transcription"], // Optional type
    };

    try {
      const result: TestResult<StartMeetingResponse> = await this.actor.start_meeting(request);
      
      if ("Ok" in result && result.Ok) {
        console.log(`✅ Meeting started: ${result.Ok.meeting_id}`);
        console.log(`   Status: ${result.Ok.status}`);
        return result.Ok.meeting_id;
      } else {
        console.error("❌ Failed to start meeting:", result.Err);
        return null;
      }
    } catch (error) {
      console.error("❌ Error starting meeting:", error);
      return null;
    }
  }

  async testAddAudio(meetingId: string) {
    console.log("🎤 Adding audio to meeting...");
    const request: AddAudioRequest = {
      meeting_id: meetingId,
      audio_data: this.audioData,
      timestamp: [BigInt(Date.now() * 1_000_000)] as [bigint], // Convert to nanoseconds - Optional type
    };

    try {
      const result: TestResult<AddAudioResponse> = await this.actor.add_audio(request);
      
      if ("Ok" in result && result.Ok) {
        console.log(`✅ Audio added: ${result.Ok.chunk_id}`);
        console.log(`   Status: ${result.Ok.status}`);
        console.log(`   Queue size: ${result.Ok.queue_size}`);
        return result.Ok.chunk_id;
      } else {
        console.error("❌ Failed to add audio:", result.Err);
        return null;
      }
    } catch (error) {
      console.error("❌ Error adding audio:", error);
      return null;
    }
  }

  async testEndMeeting(meetingId: string) {
    console.log("🏁 Ending meeting and generating summary...");
    const request: EndMeetingRequest = {
      meeting_id: meetingId,
    };

    try {
      // Wait a bit for processing
      console.log("⏳ Waiting for processing to complete...");
      await this.delay(5000);

      const result: TestResult<EndMeetingResponse> = await this.actor.end_meeting(request);
      
      if ("Ok" in result && result.Ok) {
        console.log(`✅ Meeting ended: ${result.Ok.meeting_id}`);
        console.log(`   Status: ${result.Ok.status}`);
        console.log(`   Total segments: ${result.Ok.total_segments}`);
        
        if (result.Ok.summary) {
          console.log("📝 Summary generated:");
          console.log(`   ${result.Ok.summary}`);
        } else {
          console.log("ℹ️  No summary generated (may require API key setup)");
        }
        return result.Ok;
      } else {
        console.error("❌ Failed to end meeting:", result.Err);
        return null;
      }
    } catch (error) {
      console.error("❌ Error ending meeting:", error);
      return null;
    }
  }

  async testGetMeeting(meetingId: string) {
    console.log("📖 Retrieving meeting details...");
    
    try {
      const result: TestResult<Meeting> = await this.actor.get_meeting(meetingId);
      
      if ("Ok" in result && result.Ok) {
        const meeting = result.Ok;
        console.log(`✅ Meeting retrieved: ${meeting.meeting_id}`);
        console.log(`   Title: ${meeting.title || 'Untitled'}`);
        console.log(`   Status: ${Object.keys(meeting.status)[0]}`);
        console.log(`   Transcript segments: ${meeting.transcript_segments.length}`);
        
        if (meeting.transcript_segments.length > 0) {
          console.log("🎯 Sample transcript:");
          meeting.transcript_segments.slice(0, 2).forEach((segment, i) => {
            console.log(`   [${i + 1}] ${segment.text.substring(0, 100)}...`);
          });
        }
        
        return meeting;
      } else {
        console.error("❌ Failed to get meeting:", result.Err);
        return null;
      }
    } catch (error) {
      console.error("❌ Error getting meeting:", error);
      return null;
    }
  }

  async runFullTest() {
    console.log("🚀 IC Notetaker - Full Integration Test\n");
    console.log("=" .repeat(60));

    // Health check
    const healthy = await this.testHealthCheck();
    if (!healthy) {
      console.log("❌ Skipping tests due to health check failure");
      return;
    }
    console.log();

    // Start meeting
    const meetingId = await this.testStartMeeting();
    if (!meetingId) {
      console.log("❌ Cannot continue without meeting ID");
      return;
    }
    console.log();

    // Add audio
    const chunkId = await this.testAddAudio(meetingId);
    if (!chunkId) {
      console.log("⚠️  Audio upload failed, but continuing...");
    }
    console.log();

    // End meeting (with processing)
    const endResult = await this.testEndMeeting(meetingId);
    if (!endResult) {
      console.log("⚠️  Meeting end failed, but continuing...");
    }
    console.log();

    // Get final meeting state
    const finalMeeting = await this.testGetMeeting(meetingId);
    console.log();

    console.log("=" .repeat(60));
    console.log("✨ Test complete!");
    
    if (finalMeeting?.transcript_segments && finalMeeting.transcript_segments.length > 0) {
      console.log("🎉 Transcription successful!");
    } else {
      console.log("ℹ️  No transcription (check OpenAI proxy setup)");
    }

    if (finalMeeting?.summary) {
      console.log("🎉 Summary generation successful!");
    } else {
      console.log("ℹ️  No summary (check OpenAI proxy setup)");
    }
  }
}

// Run the test
const test = new NotetakerTest();
test.runFullTest().catch(console.error);