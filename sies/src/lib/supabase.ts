import { createClient } from '@supabase/supabase-js'

// Types for scheduled medications
export interface ScheduledMedication {
  id?: string
  medication_id?: string
  medication_name: string
  dosage: string
  time: string
  food_timing?: string
  instructions?: string
}

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      medications: {
        Row: {
          id: string
          user_id: string
          name: string
          dosage: string
          frequency: string
          times_per_day: number
          food_timing: string | null
          instructions: string | null
          start_date: string
          end_date: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          dosage: string
          frequency: string
          times_per_day: number
          food_timing?: string | null
          instructions?: string | null
          start_date: string
          end_date?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          dosage?: string
          frequency?: string
          times_per_day?: number
          food_timing?: string | null
          instructions?: string | null
          start_date?: string
          end_date?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      medication_schedules: {
        Row: {
          id: string
          medication_id: string
          user_id: string
          scheduled_time: string
          day_of_week: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          medication_id: string
          user_id: string
          scheduled_time: string
          day_of_week?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          medication_id?: string
          user_id?: string
          scheduled_time?: string
          day_of_week?: number | null
          is_active?: boolean
          updated_at?: string
        }
      }
      adherence_logs: {
        Row: {
          id: string
          user_id: string
          medication_id: string
          scheduled_time: string
          actual_time: string | null
          status: 'taken' | 'missed' | 'pending' | 'skipped'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          medication_id: string
          scheduled_time: string
          actual_time?: string | null
          status: 'taken' | 'missed' | 'pending' | 'skipped'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          medication_id?: string
          scheduled_time?: string
          actual_time?: string | null
          status?: 'taken' | 'missed' | 'pending' | 'skipped'
          notes?: string | null
          updated_at?: string
        }
      }
      care_circle_members: {
        Row: {
          id: string
          patient_id: string
          member_email: string
          member_name: string
          role: 'family' | 'caregiver' | 'doctor' | 'pharmacist'
          status: 'invited' | 'active' | 'pending' | 'declined'
          permissions: string[]
          invited_at: string
          joined_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          member_email: string
          member_name: string
          role: 'family' | 'caregiver' | 'doctor' | 'pharmacist'
          status?: 'invited' | 'active' | 'pending' | 'declined'
          permissions: string[]
          invited_at?: string
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          member_email?: string
          member_name?: string
          role?: 'family' | 'caregiver' | 'doctor' | 'pharmacist'
          status?: 'invited' | 'active' | 'pending' | 'declined'
          permissions?: string[]
          invited_at?: string
          joined_at?: string | null
          updated_at?: string
        }
      }
      prescriptions: {
        Row: {
          id: string
          user_id: string
          original_text: string
          processed_data: Record<string, unknown>
          image_url: string | null
          status: 'processing' | 'completed' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          original_text: string
          processed_data?: Record<string, unknown>
          image_url?: string | null
          status?: 'processing' | 'completed' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          original_text?: string
          processed_data?: Record<string, unknown>
          image_url?: string | null
          status?: 'processing' | 'completed' | 'failed'
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Utility functions for common database operations
export const dbOperations = {
  // User operations
  async createUser(userData: Database['public']['Tables']['users']['Insert']) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getUser(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) throw error
    return data
  },

  // Medication operations
  async createMedication(medicationData: Database['public']['Tables']['medications']['Insert']) {
    const { data, error } = await supabase
      .from('medications')
      .insert(medicationData)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getUserMedications(userId: string) {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Adherence operations
  async logAdherence(adherenceData: Database['public']['Tables']['adherence_logs']['Insert']) {
    const { data, error } = await supabase
      .from('adherence_logs')
      .insert(adherenceData)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getAdherenceLogs(userId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('adherence_logs')
      .select(`
        *,
        medications (
          name,
          dosage
        )
      `)
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: false })
    
    if (startDate) {
      query = query.gte('scheduled_time', startDate)
    }
    
    if (endDate) {
      query = query.lte('scheduled_time', endDate)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data
  },

  // Care circle operations
  async addCareCircleMember(memberData: Database['public']['Tables']['care_circle_members']['Insert']) {
    const { data, error } = await supabase
      .from('care_circle_members')
      .insert(memberData)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getCareCircleMembers(patientId: string) {
    const { data, error } = await supabase
      .from('care_circle_members')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Medication schedule operations
  async createMedicationSchedule(scheduleData: Database['public']['Tables']['medication_schedules']['Insert']) {
    const { data, error } = await supabase
      .from('medication_schedules')
      .insert(scheduleData)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getUserMedicationSchedules(userId: string) {
    const { data, error } = await supabase
      .from('medication_schedules')
      .select(`
        *,
        medications (
          name,
          dosage,
          food_timing,
          instructions
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('scheduled_time', { ascending: true })
    
    if (error) throw error
    return data
  },

  async updateMedicationSchedule(scheduleId: string, updates: Database['public']['Tables']['medication_schedules']['Update']) {
    const { data, error } = await supabase
      .from('medication_schedules')
      .update(updates)
      .eq('id', scheduleId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async deleteMedicationSchedule(scheduleId: string) {
    const { error } = await supabase
      .from('medication_schedules')
      .delete()
      .eq('id', scheduleId)
    
    if (error) throw error
  },

  // Bulk operations for scheduled medications
  async saveScheduledMedications(userId: string, scheduledMedications: ScheduledMedication[]) {
    // First, deactivate existing schedules
    await supabase
      .from('medication_schedules')
      .update({ is_active: false })
      .eq('user_id', userId)

    // Then create new schedules
    const scheduleData = scheduledMedications.map(med => ({
      user_id: userId,
      medication_id: med.medication_id || null,
      medication_name: med.medication_name,
      dosage: med.dosage,
      scheduled_time: med.time,
      food_timing: med.food_timing,
      instructions: med.instructions,
      is_active: true
    }))

    if (scheduleData.length > 0) {
      const { data, error } = await supabase
        .from('medication_schedules')
        .insert(scheduleData)
        .select()
      
      if (error) throw error
      return data
    }
    
    return []
  },

  async getScheduledMedications(userId: string) {
    const { data, error } = await supabase
      .from('medication_schedules')
      .select(`
        *,
        medications (
          name,
          dosage,
          food_timing,
          instructions
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('scheduled_time', { ascending: true })
    
    if (error) throw error
    
    // Transform data to match the expected format
    return data.map(schedule => ({
      id: schedule.id,
      medication_name: schedule.medication_name || schedule.medications?.name,
      dosage: schedule.dosage || schedule.medications?.dosage,
      time: schedule.scheduled_time,
      food_timing: schedule.food_timing || schedule.medications?.food_timing,
      instructions: schedule.instructions || schedule.medications?.instructions
    }))
  },

  // Prescription history operations
  async savePrescriptionHistory(prescriptionData: Database['public']['Tables']['prescriptions']['Insert']) {
    const { data, error } = await supabase
      .from('prescriptions')
      .insert(prescriptionData)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getPrescriptionHistory(userId: string) {
    try {
      console.log('Querying prescriptions for user:', userId);
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        throw new Error('Invalid user ID format. Please ensure you are properly authenticated.');
      }
      
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Supabase query error:', error);
        if (error.code === '22P02') {
          throw new Error('Invalid user ID format. Please log out and log back in.');
        }
        throw new Error(`Database query failed: ${error.message}`);
      }
      
      console.log('Query successful, found prescriptions:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('getPrescriptionHistory error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to retrieve prescription history');
    }
  },

  async updatePrescriptionStatus(prescriptionId: string, status: 'processing' | 'completed' | 'failed') {
    const { data, error } = await supabase
      .from('prescriptions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', prescriptionId)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}