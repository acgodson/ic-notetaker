console.log('🔧 Background: Starting background script...');

import browser from "webextension-polyfill";
import {
  createActor as createICNotetakerActor,
  canisterId as icNotetakerCanisterId
} from "../../../ic-types/index.js";
import { ENV, getICAgentOptions } from "../utils/env";

console.log('✅ Background: Imports loaded successfully');


type ICNotetakerActor = ReturnType<typeof createICNotetakerActor>;

class ICNoteTakerAgent {
  private actor: ICNotetakerActor | null = null;
  private keepAliveInterval: number | null = null;

  constructor() {
    console.log('🔧 Background: Starting IC Notetaker Agent...');
    
    try {
      this.setupMessageListener();
      this.setupKeepalive();
      
      // Initialize agent in the background to avoid blocking
      this.initAgent().catch(error => {
        console.error('❌ Background: Agent initialization failed:', error);
      });
      
      console.log('✅ Background: IC Notetaker Agent constructed successfully');
    } catch (error) {
      console.error('❌ Background: Constructor failed:', error);
    }
  }

  private async initAgent() {
    try {
      // Debug environment info
      console.log("IC Notetaker: Initializing agent...");
      
      // Safe environment debugging for service worker
      console.log('🔧 IC Notetaker Environment:', {
        DFX_NETWORK: ENV.DFX_NETWORK,
        IS_LOCAL: ENV.IS_LOCAL,
        CANISTER_ID_IC_NOTETAKER_BACKEND: ENV.CANISTER_ID_IC_NOTETAKER_BACKEND,
        CANISTER_ID_INTERNET_IDENTITY: ENV.CANISTER_ID_INTERNET_IDENTITY,
      });

      // Work with anonymous actor only
      console.log("IC Notetaker: Creating anonymous actor...");
      await this.createAnonymousActor();

      console.log("IC Notetaker: Connected to canister successfully");

      // Test connection with health check
      await this.performHealthCheck();
    } catch (error) {
      console.error("IC Notetaker: Failed to initialize IC agent:", error);
    }
  }


  private async createAnonymousActor() {
    // Create anonymous actor using generated function
    this.actor = createICNotetakerActor(icNotetakerCanisterId || ENV.CANISTER_ID_IC_NOTETAKER_BACKEND, {
      agentOptions: getICAgentOptions(),
    });

    console.log("IC Notetaker: Anonymous actor created");
  }

  private async performHealthCheck() {
    try {
      if (!this.actor) {
        throw new Error("Actor not initialized");
      }

      const health = await this.actor.health_check() as Array<[string, string]>;
      console.log("IC Notetaker: Health check passed:", health);
    } catch (healthError) {
      console.warn(
        "IC Notetaker: Health check failed (may be expected):",
        healthError
      );
    }
  }


  private setupMessageListener() {
    console.log('🔧 Background: Setting up message listener...');
    
    browser.runtime.onMessage.addListener((message: any, sender: any) => {
      console.log('🔍 Background: Received message:', {
        action: message?.action,
        sender: sender?.tab?.url || 'popup',
        timestamp: new Date().toISOString()
      });
      
      try {
        switch (message?.action) {
          case "CREATE_MEETING":
            return this.createMeeting(message.data);
          case "UPLOAD_AUDIO":
            return this.uploadAudio(message.data);
          case "END_MEETING":
            return this.endMeeting(message.data);
          case "HEALTH_CHECK":
            return this.healthCheck();
          case "GET_MEETINGS":
            return this.getMeetings(message.data);
          default:
            console.log('🔍 Background: Unknown action:', message?.action);
            return Promise.resolve({ error: `Unknown action: ${message?.action}` });
        }
      } catch (error) {
        console.error('❌ Background: Message handler error:', error);
        return Promise.resolve({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
    
    console.log('✅ Background: Message listener set up successfully');
  }

  private setupKeepalive() {
    // Keep the service worker alive by pinging every 20 seconds
    this.keepAliveInterval = setInterval(() => {
      console.log('🔄 Background: Keepalive ping');
    }, 20000) as any;
    
    // Listen for when the service worker is about to terminate
    self.addEventListener('beforeunload', () => {
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
      }
    });
  }


  private async createMeeting(data: {
    title: string;
    platform: string;
  }): Promise<any> {
    try {
      if (!this.actor) {
        throw new Error("IC agent not initialized");
      }

      const request = {
        title: data.title ? [data.title] : [],
      };

      const response = await this.actor.start_meeting(request) as 
        { Ok: { meeting_id: string; status: string } } | { Err: string };

      if ("Ok" in response) {
        console.log("IC Notetaker: Meeting created:", response.Ok.meeting_id);
        return {
          meetingId: response.Ok.meeting_id,
          status: response.Ok.status,
        };
      } else {
        throw new Error(response.Err);
      }
    } catch (error) {
      console.error("IC Notetaker: Failed to create meeting:", error);
      throw error;
    }
  }

  private async uploadAudio(data: {
    meetingId: string;
    audioData: number[];
    timestamp: number;
  }): Promise<any> {
    try {
      if (!this.actor) {
        throw new Error("IC agent not initialized");
      }

      const request = {
        meeting_id: data.meetingId,
        audio_data: new Uint8Array(data.audioData), // Convert number[] to Uint8Array
        timestamp: data.timestamp
          ? ([BigInt(data.timestamp * 1_000_000)] as [bigint])
          : ([] as []), 
      };

      const response = await this.actor.add_audio(request) as 
        { Ok: { chunk_id: string; status: string; queue_size: number } } | { Err: string };

      if ("Ok" in response) {
        console.log("IC Notetaker: Audio uploaded:", response.Ok.chunk_id);
        return {
          chunkId: response.Ok.chunk_id,
          status: response.Ok.status,
          queueSize: response.Ok.queue_size,
        };
      } else {
        throw new Error(response.Err);
      }
    } catch (error) {
      console.error("IC Notetaker: Failed to upload audio:", error);
      throw error;
    }
  }

  private async endMeeting(data: { meetingId: string }): Promise<any> {
    try {
      if (!this.actor) {
        throw new Error("IC agent not initialized");
      }

      const request = {
        meeting_id: data.meetingId,
      };

      const response = await this.actor.end_meeting(request) as 
        { Ok: { meeting_id: string; status: string; summary: [] | [string]; total_segments: number } } | { Err: string };

      if ("Ok" in response) {
        console.log("IC Notetaker: Meeting ended:", response.Ok.meeting_id);
        return {
          meetingId: response.Ok.meeting_id,
          status: response.Ok.status,
          summary: response.Ok.summary[0] || null,
          totalSegments: response.Ok.total_segments,
        };
      } else {
        throw new Error(response.Err);
      }
    } catch (error) {
      console.error("IC Notetaker: Failed to end meeting:", error);
      throw error;
    }
  }

  private async healthCheck(): Promise<any> {
    try {
      if (!this.actor) {
        throw new Error("IC agent not initialized");
      }

      const response = await this.actor.health_check() as Array<[string, string]>;
      console.log("IC Notetaker: Health check:", response);
      return response;
    } catch (error) {
      console.error("IC Notetaker: Health check failed:", error);
      throw error;
    }
  }

  private async getMeetings(data: { offset?: number; limit?: number }): Promise<any> {
    try {
      if (!this.actor) {
        throw new Error("IC agent not initialized");
      }

      const offset = data?.offset || 0;
      const limit = data?.limit || 50;

      const response = await this.actor.get_meetings([offset], [limit]);
      console.log("IC Notetaker: Got meetings:", response);
      
      // Convert BigInt values to strings and clean up structure for serialization
      const cleanedMeetings = (response as any[]).map((meeting: any) => ({
        meeting_id: meeting.meeting_id,
        title: Array.isArray(meeting.title) && meeting.title.length > 0 ? meeting.title[0] : null,
        status: meeting.status.Active ? 'Active' : meeting.status.Ended ? 'Ended' : 'Failed',
        created_at: meeting.created_at.toString(),
        ended_at: Array.isArray(meeting.ended_at) && meeting.ended_at.length > 0 ? meeting.ended_at[0].toString() : null,
        segment_count: meeting.segment_count,
        has_summary: meeting.has_summary
      }));
      
      return cleanedMeetings;
    } catch (error) {
      console.error("IC Notetaker: Failed to get meetings:", error);
      throw error;
    }
  }




}

// Initialize the IC Notetaker agent with error handling
try {
  console.log('🔧 Background: Initializing IC Notetaker Agent...');
  new ICNoteTakerAgent();
  console.log('✅ Background: IC Notetaker Agent initialized successfully');
} catch (error) {
  console.error('❌ Background: Failed to initialize IC Notetaker Agent:', error);
}

// Handle extension installation
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("IC Notetaker extension installed");
    // Open welcome page or show notification
  }
});
