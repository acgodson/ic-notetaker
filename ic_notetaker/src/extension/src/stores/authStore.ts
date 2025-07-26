import { create } from 'zustand'
import { AuthClient } from '@dfinity/auth-client'
import { HttpAgent } from '@dfinity/agent'
import { Principal } from '@dfinity/principal'
import { 
  createActor as createICNotetakerActor,
  canisterId as icNotetakerCanisterId
} from '../../../ic-types/index.js'
import { 
  createActor as createInternetIdentityActor,
  canisterId as internetIdentityCanisterId
} from '../../../ic-types/internet-identity.js'
import { ENV } from '../utils/env'

type ICNotetakerActor = ReturnType<typeof createICNotetakerActor>
type InternetIdentityActor = ReturnType<typeof createInternetIdentityActor>

interface AuthState {
  // State
  isAuthenticated: boolean
  principal: Principal | null
  principalText: string | null
  authClient: AuthClient | null
  icNotetakerActor: ICNotetakerActor | null
  internetIdentityActor: InternetIdentityActor | null
  isLoading: boolean
  error: string | null

  // Actions
  init: () => Promise<void>
  login: () => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  principal: null,
  principalText: null,
  authClient: null,
  icNotetakerActor: null,
  internetIdentityActor: null,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  init: async () => {
    try {
      console.log('🔍 AuthStore: Starting auth initialization... [ZUSTAND VERSION]')
      set({ isLoading: true, error: null })

      const client = await AuthClient.create()
      set({ authClient: client })

      const isAuth = await client.isAuthenticated()
      console.log('🔍 AuthStore: AuthClient.isAuthenticated():', isAuth)

      if (isAuth) {
        const identity = client.getIdentity()
        const principalId = identity.getPrincipal()
        
        console.log('🔍 AuthStore: Principal:', principalId.toString())
        console.log('🔍 AuthStore: Is Anonymous:', principalId.isAnonymous())
        
        // Only consider truly authenticated if principal is NOT anonymous
        if (!principalId.isAnonymous()) {
          try {
            console.log('🔍 AuthStore: Creating authenticated actors...')
            
            const agent = await HttpAgent.create({
              identity,
              shouldFetchRootKey: ENV.IS_LOCAL || ENV.IS_DEV
            })

            // Verify the agent is properly configured
            const agentPrincipal = await agent.getPrincipal()
            if (!agentPrincipal.isAnonymous()) {
              // Create IC Notetaker actor
              const icActor = createICNotetakerActor(
                icNotetakerCanisterId || ENV.CANISTER_ID_IC_NOTETAKER_BACKEND, 
                { agent }
              )

              // Create Internet Identity actor
              const iiActor = createInternetIdentityActor(
                internetIdentityCanisterId || ENV.CANISTER_ID_INTERNET_IDENTITY, 
                { agent }
              )

              set({
                isAuthenticated: true,
                principal: principalId,
                principalText: principalId.toString(),
                icNotetakerActor: icActor,
                internetIdentityActor: iiActor,
                error: null
              })

              console.log('✅ AuthStore: Authenticated actors created for principal:', principalId.toString())
            } else {
              throw new Error('Agent principal is anonymous')
            }
          } catch (error) {
            console.error('❌ AuthStore: Failed to create authenticated actors:', error)
            set({
              isAuthenticated: false,
              principal: null,
              principalText: null,
              icNotetakerActor: null,
              internetIdentityActor: null,
              error: 'Failed to create authenticated actors'
            })
          }
        } else {
          console.log('⚠️ AuthStore: Principal is anonymous, treating as not authenticated')
          set({
            isAuthenticated: false,
            principal: null,
            principalText: null,
            icNotetakerActor: null,
            internetIdentityActor: null,
            error: null
          })
        }
      } else {
        console.log('❌ AuthStore: AuthClient reports not authenticated')
        set({
          isAuthenticated: false,
          principal: null,
          principalText: null,
          icNotetakerActor: null,
          internetIdentityActor: null,
          error: null
        })
      }
    } catch (error) {
      console.error('❌ AuthStore: Auth initialization failed:', error)
      set({
        isAuthenticated: false,
        principal: null,
        principalText: null,
        icNotetakerActor: null,
        internetIdentityActor: null,
        error: error instanceof Error ? error.message : 'Auth initialization failed'
      })
    } finally {
      set({ isLoading: false })
      
      const state = get()
      console.log('🔍 AuthStore: Auth initialization complete. Final state:', {
        isAuthenticated: state.isAuthenticated,
        hasActor: !!state.icNotetakerActor,
        principalText: state.principalText,
        error: state.error
      })
    }
  },

  login: async () => {
    const { authClient } = get()
    if (!authClient) {
      console.error('❌ AuthStore: AuthClient not initialized')
      set({ error: 'AuthClient not initialized' })
      return
    }

    try {
      set({ isLoading: true, error: null })
      console.log('🔍 AuthStore: Starting login process...')

      await authClient.login({
        identityProvider: ENV.IS_LOCAL
          ? `http://${ENV.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943`
          : "https://identity.ic0.app",
        maxTimeToLive: BigInt(8 * 60 * 60 * 1000 * 1000 * 1000), // 8 hours
        onSuccess: async () => {
          try {
            console.log('🔍 AuthStore: Login successful, creating actors...')
            const identity = authClient.getIdentity()
            const principalId = identity.getPrincipal()

            const agent = await HttpAgent.create({
              identity,
              shouldFetchRootKey: ENV.IS_LOCAL || ENV.IS_DEV
            })

            // Create actors
            const icActor = createICNotetakerActor(
              icNotetakerCanisterId || ENV.CANISTER_ID_IC_NOTETAKER_BACKEND, 
              { agent }
            )

            const iiActor = createInternetIdentityActor(
              internetIdentityCanisterId || ENV.CANISTER_ID_INTERNET_IDENTITY, 
              { agent }
            )

            set({
              isAuthenticated: true,
              principal: principalId,
              principalText: principalId.toString(),
              icNotetakerActor: icActor,
              internetIdentityActor: iiActor,
              isLoading: false,
              error: null
            })
            
            console.log('✅ AuthStore: Login successful for principal:', principalId.toString())
          } catch (error) {
            console.error('❌ AuthStore: Failed to create actors after login:', error)
            set({
              isLoading: false,
              error: 'Failed to create actors after login'
            })
          }
        },
        onError: (error) => {
          console.error('❌ AuthStore: Login failed:', error)
          set({
            isLoading: false,
            error: 'Login failed'
          })
        }
      })
    } catch (error) {
      console.error('❌ AuthStore: Login process failed:', error)
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed'
      })
    }
  },

  logout: async () => {
    const { authClient } = get()
    if (!authClient) return

    try {
      await authClient.logout()
      set({
        isAuthenticated: false,
        principal: null,
        principalText: null,
        icNotetakerActor: null,
        internetIdentityActor: null,
        error: null
      })
      console.log('✅ AuthStore: Logout successful')
    } catch (error) {
      console.error('❌ AuthStore: Logout failed:', error)
      set({ error: 'Logout failed' })
    }
  }
}))