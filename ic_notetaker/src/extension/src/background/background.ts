console.log('🔧 Background: Starting background script...');

import browser from "webextension-polyfill";
import { HttpAgent } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { Principal } from "@dfinity/principal";
import {
  createActor as createICNotetakerActor,
  canisterId as icNotetakerCanisterId
} from "../../../ic-types/index.js";
import { ENV, shouldFetchRootKey, getICAgentOptions } from "../utils/env";

console.log('✅ Background: Imports loaded successfully');


type ICNotetakerActor = ReturnType<typeof createICNotetakerActor>;

class ICNoteTakerAgent {
  private actor: ICNotetakerActor | null = null;
  private agent: HttpAgent | null = null;
  private authClient: AuthClient | null = null;
  private isAuthenticated: boolean = false;
  private principal: Principal | null = null;
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

      // Initialize auth client - use options that work in service worker
      console.log("IC Notetaker: Creating AuthClient...");
      this.authClient = await AuthClient.create({
        idleOptions: {
          disableIdle: true
        }
      });
      
      console.log("IC Notetaker: Checking authentication status...");
      const isAuthenticatedByClient = await this.authClient.isAuthenticated();
      
      if (isAuthenticatedByClient) {
        const identity = this.authClient.getIdentity();
        const principal = identity.getPrincipal();
        
        console.log('🔍 Background: Auth check on init:', {
          isAuthenticatedByClient,
          principal: principal.toString(),
          isAnonymous: principal.isAnonymous()
        });
        
        // Only consider truly authenticated if principal is NOT anonymous
        if (!principal.isAnonymous()) {
          console.log(
            "IC Notetaker: User is authenticated, creating authenticated actor"
          );
          this.isAuthenticated = true;
          await this.createAuthenticatedActor();
        } else {
          console.log(
            "IC Notetaker: Principal is anonymous, creating anonymous actor"
          );
          this.isAuthenticated = false;
          await this.createAnonymousActor();
        }
      } else {
        console.log(
          "IC Notetaker: User not authenticated, creating anonymous actor"
        );
        this.isAuthenticated = false;
        await this.createAnonymousActor();
      }

      console.log("IC Notetaker: Connected to canister successfully");

      // Test connection with health check
      await this.performHealthCheck();
    } catch (error) {
      console.error("IC Notetaker: Failed to initialize IC agent:", error);
    }
  }

  private async createAuthenticatedActor() {
    if (!this.authClient || !this.isAuthenticated) {
      throw new Error("Auth client not initialized or not authenticated");
    }

    const identity = this.authClient.getIdentity();
    this.principal = identity.getPrincipal();

    // Create HTTP agent with identity
    this.agent = new HttpAgent({
      identity,
      ...getICAgentOptions(),
    });

    // Only fetch root key in development/local
    if (shouldFetchRootKey()) {
      console.log("IC Notetaker: Fetching root key for local development");
      await this.agent.fetchRootKey();
    }

    // Create authenticated actor using generated function
    this.actor = createICNotetakerActor(icNotetakerCanisterId || ENV.CANISTER_ID_IC_NOTETAKER_BACKEND, {
      agent: this.agent,
    });

    console.log(
      "IC Notetaker: Authenticated actor created for principal:",
      this.principal.toString()
    );
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

  // Method to authenticate user
  private async authenticate() {
    if (!this.authClient) {
      throw new Error("Auth client not initialized");
    }

    console.log('🔍 Background: Configuring authentication...');
    const identityProvider = ENV.IS_LOCAL
      ? `http://${ENV.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943`
      : "https://identity.ic0.app";
    
    console.log('🔍 Background: Identity provider:', identityProvider);

    return new Promise<void>((resolve, reject) => {
      try {
        this.authClient!.login({
          identityProvider,
          maxTimeToLive: BigInt(8 * 60 * 60 * 1000 * 1000 * 1000), // 8 hours
          onSuccess: async () => {
            try {
              console.log("✅ Background: Authentication callback - success");
              this.isAuthenticated = true;
              await this.createAuthenticatedActor();
              console.log("✅ Background: Authentication complete");
              resolve();
            } catch (error) {
              console.error(
                "❌ Background: Failed to create authenticated actor:",
                error
              );
              reject(error);
            }
          },
          onError: (error) => {
            console.error("❌ Background: Authentication failed:", error);
            reject(error);
          },
        });
      } catch (error) {
        console.error("❌ Background: Error starting login:", error);
        reject(error);
      }
    });
  }

  // Method to logout user
  private async logout() {
    if (!this.authClient) {
      throw new Error("Auth client not initialized");
    }

    try {
      await this.authClient.logout();
      this.isAuthenticated = false;
      this.principal = null;
      await this.createAnonymousActor();
      console.log(
        "IC Notetaker: Logout successful, switched to anonymous actor"
      );
    } catch (error) {
      console.error("IC Notetaker: Logout failed:", error);
      throw error;
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
          case "AUTHENTICATE":
            return this.authenticate();
          case "LOGIN":
            return this.handleLogin();
          case "OPEN_AUTH_TAB":
            return this.openAuthTab();
          case "LOGOUT":
            return this.logout();
          case "GET_AUTH_STATUS":
          case "CHECK_AUTH_STATUS":
            return this.getAuthStatus();
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

  private async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    principalText?: string;
  }> {
    try {
      console.log('🔍 Background: Getting auth status...');
      
      // Double-check authentication status
      if (this.authClient && this.principal) {
        const isAuth = await this.authClient.isAuthenticated();
        const isAnonymous = this.principal.isAnonymous();
        
        console.log('🔍 Background: Auth status check:', {
          authClientAuth: isAuth,
          isAnonymous,
          storedAuth: this.isAuthenticated,
          principal: this.principal.toString()
        });
        
        // Only consider authenticated if not anonymous
        const actuallyAuthenticated = isAuth && !isAnonymous;
        
        return {
          isAuthenticated: actuallyAuthenticated,
          principalText: actuallyAuthenticated ? this.principal.toString() : undefined,
        };
      }
      
      console.log('🔍 Background: No auth client or principal available');
      return {
        isAuthenticated: false,
        principalText: undefined,
      };
    } catch (error) {
      console.error('❌ Background: Error getting auth status:', error);
      return {
        isAuthenticated: false,
        principalText: undefined,
      };
    }
  }

  private async handleLogin(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔍 Background: Handling login request...');
      
      // The issue is that AuthClient.login() tries to open a popup which doesn't work
      // in service workers. We need to create a different approach.
      // For now, let's try to create the auth client without the login call
      
      if (!this.authClient) {
        console.log('🔍 Background: Creating auth client...');
        this.authClient = await AuthClient.create({
          idleOptions: {
            disableIdle: true
          }
        });
      }
      
      console.log('🔍 Background: Auth client created, but login popup not supported in service worker');
      
      // For Chrome extensions, we need to either:
      // 1. Use chrome.identity API, or
      // 2. Open authentication in a popup/tab and handle the callback
      // 3. Use a different authentication flow
      
      // For now, let's return an error asking user to use the popup
      return { 
        success: false, 
        error: 'Please use the extension popup to authenticate. Service worker cannot open popup windows.' 
      };
      
    } catch (error) {
      console.error('❌ Background: Login failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
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
        title: data.title ? ([data.title] as [string]) : ([] as []),
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
        audio_data: data.audioData,
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

  private async openAuthTab(): Promise<{ success: boolean; error?: string; tabId?: number }> {
    try {
      console.log('🔍 Background: Starting Internet Identity authentication...');
      
      if (!this.authClient) {
        console.log('🔍 Background: Creating auth client...');
        this.authClient = await AuthClient.create({
          idleOptions: {
            disableIdle: true
          }
        });
      }

      const identityProvider = ENV.IS_LOCAL
        ? `http://${ENV.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943`
        : "https://identity.ic0.app";
      
      console.log('🔍 Background: Using identity provider:', identityProvider);
      
      // Create a proper auth URL with application context
      // This tells II that we want to authenticate for a specific app
      const appUrl = browser.runtime.getURL('');
      const authUrl = `${identityProvider}/?applicationName=IC%20Notetaker&applicationLogo=${encodeURIComponent(browser.runtime.getURL('icons/icon-48.png'))}&`; 
      
      console.log('🔍 Background: Opening auth URL:', authUrl);
      
      // Open the auth tab
      const tab = await browser.tabs.create({
        url: authUrl,
        active: true
      });
      
      if (tab.id) {
        console.log('✅ Background: Auth tab opened with ID:', tab.id);
        
        // Set up monitoring for the authentication process
        this.setupAuthTabMonitoring(tab.id);
        
        return {
          success: true,
          tabId: tab.id
        };
      } else {
        throw new Error('Failed to create tab');
      }
      
    } catch (error) {
      console.error('❌ Background: Failed to open auth tab:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open authentication tab'
      };
    }
  }

  private setupAuthTabMonitoring(tabId: number): void {
    console.log('🔍 Background: Setting up auth tab monitoring...');
    
    const checkAuthStatus = async () => {
      try {
        if (this.authClient) {
          const isAuth = await this.authClient.isAuthenticated();
          if (isAuth) {
            const identity = this.authClient.getIdentity();
            const principal = identity.getPrincipal();
            
            if (!principal.isAnonymous()) {
              console.log('✅ Background: Authentication detected!', principal.toString());
              this.isAuthenticated = true;
              await this.createAuthenticatedActor();
              
              // Close the auth tab
              try {
                await browser.tabs.remove(tabId);
              } catch (e) {
                console.warn('⚠️ Background: Could not close auth tab:', e);
              }
              
              return true; // Auth complete
            }
          }
        }
        return false; // Auth not complete
      } catch (error) {
        console.warn('⚠️ Background: Auth status check failed:', error);
        return false;
      }
    };

    // Poll for authentication every 2 seconds
    const pollInterval = setInterval(async () => {
      const authComplete = await checkAuthStatus();
      if (authComplete) {
        clearInterval(pollInterval);
        console.log('✅ Background: Auth monitoring stopped - authentication complete');
      }
    }, 2000);

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      console.log('⏱️ Background: Auth monitoring stopped - timeout');
    }, 600000);

    // Also monitor tab closure
    const handleTabRemoved = (removedTabId: number) => {
      if (removedTabId === tabId) {
        clearInterval(pollInterval);
        browser.tabs.onRemoved.removeListener(handleTabRemoved);
        console.log('🔍 Background: Auth tab closed by user');
      }
    };

    browser.tabs.onRemoved.addListener(handleTabRemoved);
  }

  private setupAuthCompletionListener(): void {
    console.log('🔍 Background: Setting up auth completion listener...');
    
    const handleAuthComplete = (message: any, sender: any) => {
      if (message?.action === 'AUTH_COMPLETE') {
        console.log('✅ Background: Received auth completion message:', message.data);
        
        if (message.data?.success) {
          // Re-initialize the agent to pick up the new authentication
          this.initAgent().then(() => {
            console.log('✅ Background: Agent re-initialized after auth completion');
          }).catch(error => {
            console.error('❌ Background: Failed to re-initialize agent:', error);
          });
        }
        
        // Remove the listener to avoid duplicates
        browser.runtime.onMessage.removeListener(handleAuthComplete);
      }
    };
    
    // Add the listener
    browser.runtime.onMessage.addListener(handleAuthComplete);
    
    // Auto-cleanup after 10 minutes
    setTimeout(() => {
      browser.runtime.onMessage.removeListener(handleAuthComplete);
      console.log('🔍 Background: Auth completion listener cleaned up after timeout');
    }, 600000);
  }

  private setupAuthTabListener(tabId: number): void {
    console.log('🔍 Background: Setting up auth tab listener for tab:', tabId);
    
    const handleTabUpdate = async (updatedTabId: number, changeInfo: any, tab: any) => {
      // Only listen for updates to our auth tab
      if (updatedTabId !== tabId) return;
      
      // Check if the tab has been updated
      if (changeInfo.status === 'complete' && tab.url) {
        console.log('🔍 Background: Auth tab updated:', tab.url);
        
        // If user completed authentication on II, redirect to our callback page
        if ((tab.url.includes('identity.ic0.app') || tab.url.includes('.localhost:4943')) && 
            !tab.url.includes('auth-callback.html')) {
          
          // Check if the URL indicates successful authentication
          // II typically redirects back with fragments or parameters
          if (tab.url.includes('#') || tab.url.includes('authenticated')) {
            console.log('🔍 Background: Detected potential auth completion, redirecting to callback...');
            
            // Redirect to our callback page
            const callbackUrl = browser.runtime.getURL('auth-callback.html');
            await browser.tabs.update(tabId, { url: callbackUrl });
          }
        }
      }
    };
    
    const handleTabRemoved = (removedTabId: number) => {
      if (removedTabId === tabId) {
        console.log('🔍 Background: Auth tab closed:', removedTabId);
        // Clean up listeners
        browser.tabs.onUpdated.removeListener(handleTabUpdate);
        browser.tabs.onRemoved.removeListener(handleTabRemoved);
      }
    };
    
    // Add listeners
    browser.tabs.onUpdated.addListener(handleTabUpdate);
    browser.tabs.onRemoved.addListener(handleTabRemoved);
    
    // Auto-cleanup after 10 minutes
    setTimeout(() => {
      browser.tabs.onUpdated.removeListener(handleTabUpdate);
      browser.tabs.onRemoved.removeListener(handleTabRemoved);
      console.log('🔍 Background: Auth tab listeners cleaned up after timeout');
    }, 600000);
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
