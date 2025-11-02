import { useState, useEffect } from 'react'
import { supabase, dbOperations, Database } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { toast } from 'sonner'

// Types for the hook
type Medication = Database['public']['Tables']['medications']['Row']
type AdherenceLog = Database['public']['Tables']['adherence_logs']['Row']
type CareCircleMember = Database['public']['Tables']['care_circle_members']['Row']
type Prescription = Database['public']['Tables']['prescriptions']['Row']

export const useSupabase = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Authentication functions
  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) throw error
      
      if (data.user) {
        toast.success('Account created successfully! Please check your email to verify your account.')
      }
      
      return { data, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      toast.error('Failed to create account')
      return { data: null, error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      
      toast.success('Signed in successfully!')
      return { data, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      toast.error('Failed to sign in')
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      toast.success('Signed out successfully!')
      return { error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
      return { error }
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error
      
      toast.success('Password reset email sent!')
      return { error: null }
    } catch (error) {
      console.error('Password reset error:', error)
      toast.error('Failed to send password reset email')
      return { error }
    }
  }

  return {
    // Auth state
    user,
    loading,
    isAuthenticated: !!user,

    // Auth functions
    signUp,
    signIn,
    signOut,
    resetPassword,

    // Database operations
    db: {
      // User operations
      async createUser(userData: Database['public']['Tables']['users']['Insert']) {
        try {
          return await dbOperations.createUser(userData)
        } catch (error) {
          console.error('Create user error:', error)
          toast.error('Failed to create user profile')
          throw error
        }
      },

      async getUser(userId: string) {
        try {
          return await dbOperations.getUser(userId)
        } catch (error) {
          console.error('Get user error:', error)
          toast.error('Failed to fetch user profile')
          throw error
        }
      },

      // Medication operations
      async createMedication(medicationData: Database['public']['Tables']['medications']['Insert']) {
        try {
          const result = await dbOperations.createMedication(medicationData)
          toast.success('Medication added successfully!')
          return result
        } catch (error) {
          console.error('Create medication error:', error)
          toast.error('Failed to add medication')
          throw error
        }
      },

      async getUserMedications(userId: string) {
        try {
          return await dbOperations.getUserMedications(userId)
        } catch (error) {
          console.error('Get medications error:', error)
          toast.error('Failed to fetch medications')
          throw error
        }
      },

      async updateMedication(
        medicationId: string, 
        updates: Database['public']['Tables']['medications']['Update']
      ) {
        try {
          const { data, error } = await supabase
            .from('medications')
            .update(updates)
            .eq('id', medicationId)
            .select()
            .single()

          if (error) throw error
          
          toast.success('Medication updated successfully!')
          return data
        } catch (error) {
          console.error('Update medication error:', error)
          toast.error('Failed to update medication')
          throw error
        }
      },

      async deleteMedication(medicationId: string) {
        try {
          const { error } = await supabase
            .from('medications')
            .update({ is_active: false })
            .eq('id', medicationId)

          if (error) throw error
          
          toast.success('Medication removed successfully!')
        } catch (error) {
          console.error('Delete medication error:', error)
          toast.error('Failed to remove medication')
          throw error
        }
      },

      // Adherence operations
      async logAdherence(adherenceData: Database['public']['Tables']['adherence_logs']['Insert']) {
        try {
          const result = await dbOperations.logAdherence(adherenceData)
          toast.success('Adherence logged successfully!')
          return result
        } catch (error) {
          console.error('Log adherence error:', error)
          toast.error('Failed to log adherence')
          throw error
        }
      },

      async getAdherenceLogs(userId: string, startDate?: string, endDate?: string) {
        try {
          return await dbOperations.getAdherenceLogs(userId, startDate, endDate)
        } catch (error) {
          console.error('Get adherence logs error:', error)
          toast.error('Failed to fetch adherence data')
          throw error
        }
      },

      async updateAdherenceLog(
        logId: string, 
        updates: Database['public']['Tables']['adherence_logs']['Update']
      ) {
        try {
          const { data, error } = await supabase
            .from('adherence_logs')
            .update(updates)
            .eq('id', logId)
            .select()
            .single()

          if (error) throw error
          
          return data
        } catch (error) {
          console.error('Update adherence log error:', error)
          toast.error('Failed to update adherence log')
          throw error
        }
      },

      // Care circle operations
      async addCareCircleMember(memberData: Database['public']['Tables']['care_circle_members']['Insert']) {
        try {
          const result = await dbOperations.addCareCircleMember(memberData)
          toast.success('Care circle member added successfully!')
          return result
        } catch (error) {
          console.error('Add care circle member error:', error)
          toast.error('Failed to add care circle member')
          throw error
        }
      },

      async getCareCircleMembers(patientId: string) {
        try {
          return await dbOperations.getCareCircleMembers(patientId)
        } catch (error) {
          console.error('Get care circle members error:', error)
          toast.error('Failed to fetch care circle members')
          throw error
        }
      },

      async updateCareCircleMember(
        memberId: string, 
        updates: Database['public']['Tables']['care_circle_members']['Update']
      ) {
        try {
          const { data, error } = await supabase
            .from('care_circle_members')
            .update(updates)
            .eq('id', memberId)
            .select()
            .single()

          if (error) throw error
          
          toast.success('Care circle member updated successfully!')
          return data
        } catch (error) {
          console.error('Update care circle member error:', error)
          toast.error('Failed to update care circle member')
          throw error
        }
      },

      async removeCareCircleMember(memberId: string) {
        try {
          const { error } = await supabase
            .from('care_circle_members')
            .delete()
            .eq('id', memberId)

          if (error) throw error
          
          toast.success('Care circle member removed successfully!')
        } catch (error) {
          console.error('Remove care circle member error:', error)
          toast.error('Failed to remove care circle member')
          throw error
        }
      },

      // Prescription operations
      async createPrescription(prescriptionData: Database['public']['Tables']['prescriptions']['Insert']) {
        try {
          const { data, error } = await supabase
            .from('prescriptions')
            .insert(prescriptionData)
            .select()
            .single()

          if (error) throw error
          
          toast.success('Prescription saved successfully!')
          return data
        } catch (error) {
          console.error('Create prescription error:', error)
          toast.error('Failed to save prescription')
          throw error
        }
      },

      async getUserPrescriptions(userId: string) {
        try {
          const { data, error } = await supabase
            .from('prescriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

          if (error) throw error
          return data
        } catch (error) {
          console.error('Get prescriptions error:', error)
          toast.error('Failed to fetch prescriptions')
          throw error
        }
      },

      // Analytics functions
      async getAdherenceRate(userId: string, startDate?: string, endDate?: string) {
        try {
          const { data, error } = await supabase
            .rpc('calculate_adherence_rate', {
              p_user_id: userId,
              p_start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              p_end_date: endDate || new Date().toISOString().split('T')[0]
            })

          if (error) throw error
          return data
        } catch (error) {
          console.error('Get adherence rate error:', error)
          return 0
        }
      },

      async getUpcomingDoses(userId: string, limit = 10) {
        try {
          const { data, error } = await supabase
            .rpc('get_upcoming_doses', {
              p_user_id: userId,
              p_limit: limit
            })

          if (error) throw error
          return data
        } catch (error) {
          console.error('Get upcoming doses error:', error)
          return []
        }
      }
    }
  }
}

// Custom hooks for specific operations
export const useMedications = (userId?: string) => {
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const { db } = useSupabase()

  useEffect(() => {
    if (userId) {
      loadMedications()
    }
  }, [userId])

  const loadMedications = async () => {
    if (!userId) return
    
    try {
      setLoading(true)
      const data = await db.getUserMedications(userId)
      setMedications(data)
    } catch (error) {
      console.error('Failed to load medications:', error)
    } finally {
      setLoading(false)
    }
  }

  return {
    medications,
    loading,
    refetch: loadMedications
  }
}

export const useAdherenceLogs = (userId?: string, startDate?: string, endDate?: string) => {
  const [logs, setLogs] = useState<AdherenceLog[]>([])
  const [loading, setLoading] = useState(true)
  const { db } = useSupabase()

  useEffect(() => {
    if (userId) {
      loadLogs()
    }
  }, [userId, startDate, endDate])

  const loadLogs = async () => {
    if (!userId) return
    
    try {
      setLoading(true)
      const data = await db.getAdherenceLogs(userId, startDate, endDate)
      setLogs(data)
    } catch (error) {
      console.error('Failed to load adherence logs:', error)
    } finally {
      setLoading(false)
    }
  }

  return {
    logs,
    loading,
    refetch: loadLogs
  }
}

export const useCareCircle = (patientId?: string) => {
  const [members, setMembers] = useState<CareCircleMember[]>([])
  const [loading, setLoading] = useState(true)
  const { db } = useSupabase()

  useEffect(() => {
    if (patientId) {
      loadMembers()
    }
  }, [patientId])

  const loadMembers = async () => {
    if (!patientId) return
    
    try {
      setLoading(true)
      const data = await db.getCareCircleMembers(patientId)
      setMembers(data)
    } catch (error) {
      console.error('Failed to load care circle members:', error)
    } finally {
      setLoading(false)
    }
  }

  return {
    members,
    loading,
    refetch: loadMembers
  }
}