import React, { useEffect, useState } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { ENV } from '../utils/env';

const AuthCallback: React.FC = () => {
  const [status, setStatus] = useState('Processing authentication...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      console.log('🔍 Auth Callback: Starting authentication processing...');
      setStatus('Creating authentication client...');
      
      // Create AuthClient in web app context (has proper DOM access)
      const authClient = await AuthClient.create({
        idleOptions: {
          disableIdle: true
        }
      });
      
      console.log('🔍 Auth Callback: Checking authentication status...');
      setStatus('Checking authentication status...');
      
      const isAuthenticated = await authClient.isAuthenticated();
      
      if (isAuthenticated) {
        const identity = authClient.getIdentity();
        const principal = identity.getPrincipal();
        
        console.log('✅ Auth Callback: Authentication successful!', principal.toString());
        
        if (!principal.isAnonymous()) {
          setStatus('Authentication successful! Communicating with extension...');
          
          // Send authentication data to extension (only serializable data)
          await communicateWithExtension({
            success: true,
            principalText: principal.toString()
          });
          
          setStatus('✅ Authentication completed! You can close this tab.');
          
          // Auto-close after 3 seconds
          setTimeout(() => {
            window.close();
          }, 3000);
          
        } else {
          throw new Error('Principal is anonymous - authentication incomplete');
        }
      } else {
        // User hasn't completed authentication yet, start the flow
        console.log('🔍 Auth Callback: Starting Internet Identity login...');
        setStatus('Redirecting to Internet Identity...');
        
        const identityProvider = ENV.IS_LOCAL
          ? `http://${ENV.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943`
          : "https://identity.ic0.app";
        
        await authClient.login({
          identityProvider,
          maxTimeToLive: BigInt(8 * 60 * 60 * 1000 * 1000 * 1000), // 8 hours
          windowOpenerFeatures: 'width=500,height=500,left=100,top=100',
          derivationOrigin: window.location.origin,
          onSuccess: async () => {
            console.log('✅ Auth Callback: Login success callback triggered');
            // Recursively call to process the successful authentication
            await handleAuthCallback();
          },
          onError: (error) => {
            console.error('❌ Auth Callback: Login failed:', error);
            setError(error || 'Authentication failed');
            setStatus('❌ Authentication failed');
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Auth Callback: Error during authentication:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setStatus('❌ Authentication failed');
      
      // Notify extension of failure
      await communicateWithExtension({
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      });
    }
  };

  const communicateWithExtension = async (authData: any) => {
    try {
      console.log('🔍 Auth Callback: Attempting to communicate with extension...');
      
      // Method 1: Try to communicate via window.postMessage to extension content scripts
      window.postMessage({
        type: 'IC_NOTETAKER_AUTH_RESULT',
        data: authData,
        source: 'ic-notetaker-auth-callback'
      }, '*');
      
      // Method 2: Try chrome.runtime.sendMessage with extension ID from URL params
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          // Get extension ID from URL search params if provided
          const urlParams = new URLSearchParams(window.location.search);
          const extensionId = urlParams.get('extensionId');
          
          if (extensionId) {
            await chrome.runtime.sendMessage(extensionId, {
              action: 'AUTH_BRIDGE_RESULT',
              data: authData
            });
            console.log('✅ Auth Callback: Notified extension via chrome.runtime.sendMessage with ID:', extensionId);
          } else {
            console.warn('⚠️ Auth Callback: No extension ID provided in URL params');
          }
        } catch (chromeError) {
          console.warn('⚠️ Auth Callback: chrome.runtime.sendMessage failed:', chromeError);
        }
      }
      
      // Method 3: Use localStorage as a fallback communication method
      try {
        localStorage.setItem('ic_notetaker_auth_result', JSON.stringify({
          timestamp: Date.now(),
          data: authData
        }));
        console.log('✅ Auth Callback: Stored auth result in localStorage');
        
        // Trigger storage event
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'ic_notetaker_auth_result',
          newValue: JSON.stringify(authData),
          url: window.location.href
        }));
      } catch (storageError) {
        console.warn('⚠️ Auth Callback: localStorage communication failed:', storageError);
      }
      
      console.log('✅ Auth Callback: Communication attempts completed');
      
    } catch (error) {
      console.error('❌ Auth Callback: Failed to communicate with extension:', error);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '40px',
        textAlign: 'center',
        maxWidth: '500px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{ margin: '0 0 30px 0', fontSize: '28px' }}>
          🎙️ IC Notetaker Authentication
        </h1>
        
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderRadius: '50%',
          borderTop: '4px solid white',
          animation: 'spin 1s linear infinite',
          margin: '20px auto'
        }} />
        
        <p style={{ 
          fontSize: '18px', 
          margin: '20px 0',
          lineHeight: '1.5'
        }}>
          {status}
        </p>
        
        {error && (
          <div style={{
            background: 'rgba(244, 67, 54, 0.2)',
            border: '1px solid rgba(244, 67, 54, 0.4)',
            borderRadius: '10px',
            padding: '15px',
            margin: '20px 0',
            fontSize: '14px'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        
        <p style={{ 
          fontSize: '14px', 
          opacity: 0.8,
          margin: '30px 0 0 0'
        }}>
          This page will close automatically once authentication is complete.
        </p>
        
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    </div>
  );
};

export default AuthCallback;