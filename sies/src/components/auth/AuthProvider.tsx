import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, AuthResponse, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string, fullName?: string) => Promise<{ data: AuthResponse['data'] | null; error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ data: AuthResponse['data'] | null; error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
        } else {
          setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      
      setUser(session?.user ?? null)
      setLoading(false)

      // Handle different auth events
      switch (event) {
        case 'SIGNED_IN':
          // Create user profile if it doesn't exist
          if (session?.user) {
            try {
              const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('id', session.user.id)
                .single()

              if (!existingUser) {
                // Create user profile
                const { error: profileError } = await supabase
                  .from('users')
                  .insert({
                    id: session.user.id,
                    email: session.user.email!,
                    full_name: session.user.user_metadata?.full_name || '',
                    created_at: new Date().toISOString(),
                  })

                if (profileError) {
                  console.error('Error creating user profile:', profileError)
                }
              }
            } catch (error) {
              console.error('Error handling user profile:', error)
            }
          }
          break
        case 'SIGNED_OUT':
          // Clear any cached data
          break
        case 'TOKEN_REFRESHED':
          // Handle token refresh if needed
          break
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        console.error('Sign up error:', error)
        toast.error(error.message || 'Failed to create account')
        return { data: null, error }
      }

      if (data.user && !data.session) {
        toast.success('Account created! Please check your email to verify your account.')
      } else if (data.session) {
        toast.success('Account created and signed in successfully!')
      }

      return { data, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      toast.error('An unexpected error occurred')
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Sign in error:', error)
        toast.error(error.message || 'Failed to sign in')
        return { data: null, error }
      }

      toast.success('Signed in successfully!')
      return { data, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      toast.error('An unexpected error occurred')
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Sign out error:', error)
        toast.error(error.message || 'Failed to sign out')
        return { error }
      }

      toast.success('Signed out successfully!')
      return { error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('An unexpected error occurred')
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        console.error('Password reset error:', error)
        toast.error(error.message || 'Failed to send password reset email')
        return { error }
      }

      toast.success('Password reset email sent! Check your inbox.')
      return { error: null }
    } catch (error) {
      console.error('Password reset error:', error)
      toast.error('An unexpected error occurred')
      return { error }
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider