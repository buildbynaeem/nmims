import { googleHealthcareAPI, FHIRConverters } from './googleHealthcare';
import { supabase } from './supabase';

export interface SyncResult {
  success: boolean;
  message: string;
  syncedCount?: number;
  errors?: string[];
}

export class HealthcareSyncService {
  
  // Sync user data to FHIR Patient resource
  async syncUserToFHIR(userId: string): Promise<SyncResult> {
    try {
      // Get user data from Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return {
          success: false,
          message: 'User not found in database'
        };
      }

      // Convert to FHIR Patient
      const fhirPatient = FHIRConverters.userToFHIRPatient(user);
      
      // Check if patient already exists in FHIR store
      try {
        await googleHealthcareAPI.getPatient(userId);
        // Patient exists, update it
        await googleHealthcareAPI.updatePatient(userId, fhirPatient);
        return {
          success: true,
          message: 'Patient updated in FHIR store',
          syncedCount: 1
        };
      } catch {
        // Patient doesn't exist, create it
        await googleHealthcareAPI.createPatient({ ...fhirPatient, id: userId });
        return {
          success: true,
          message: 'Patient created in FHIR store',
          syncedCount: 1
        };
      }
    } catch (error) {
      console.error('Error syncing user to FHIR:', error);
      return {
        success: false,
        message: 'Failed to sync user to FHIR store',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Sync user medications to FHIR
  async syncUserMedicationsToFHIR(userId: string): Promise<SyncResult> {
    try {
      // Ensure user exists in FHIR first
      const userSyncResult = await this.syncUserToFHIR(userId);
      if (!userSyncResult.success) {
        return userSyncResult;
      }

      // Get user medications from Supabase
      const { data: medications, error } = await supabase
        .from('user_medications')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch user medications',
          errors: [error.message]
        };
      }

      if (!medications || medications.length === 0) {
        return {
          success: true,
          message: 'No medications to sync',
          syncedCount: 0
        };
      }

      const errors: string[] = [];
      let syncedCount = 0;

      for (const medication of medications) {
        try {
          // Create FHIR Medication resource
          const fhirMedication = FHIRConverters.medicationToFHIRMedication(medication);
          await googleHealthcareAPI.createMedication({ ...fhirMedication, id: medication.id });

          // Create FHIR MedicationRequest (prescription)
          const fhirRequest = FHIRConverters.medicationToFHIRRequest(medication, userId);
          await googleHealthcareAPI.createMedicationRequest(fhirRequest);

          syncedCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to sync medication ${medication.name}: ${errorMessage}`);
        }
      }

      return {
        success: errors.length === 0,
        message: errors.length === 0 
          ? `Successfully synced ${syncedCount} medications`
          : `Synced ${syncedCount} medications with ${errors.length} errors`,
        syncedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Error syncing medications to FHIR:', error);
      return {
        success: false,
        message: 'Failed to sync medications to FHIR store',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Sync medication adherence logs to FHIR
  async syncAdherenceLogsToFHIR(userId: string, startDate?: string, endDate?: string): Promise<SyncResult> {
    try {
      // Build query for adherence logs
      let query = supabase
        .from('medication_logs')
        .select(`
          *,
          user_medications!inner(*)
        `)
        .eq('user_medications.user_id', userId);

      if (startDate) {
        query = query.gte('scheduled_time', startDate);
      }
      if (endDate) {
        query = query.lte('scheduled_time', endDate);
      }

      const { data: adherenceLogs, error } = await query;

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch adherence logs',
          errors: [error.message]
        };
      }

      if (!adherenceLogs || adherenceLogs.length === 0) {
        return {
          success: true,
          message: 'No adherence logs to sync',
          syncedCount: 0
        };
      }

      const errors: string[] = [];
      let syncedCount = 0;

      for (const log of adherenceLogs) {
        try {
          // Create FHIR MedicationStatement
          const fhirStatement = FHIRConverters.adherenceToFHIRStatement(log, userId);
          await googleHealthcareAPI.createMedicationStatement(fhirStatement);
          syncedCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to sync adherence log ${log.id}: ${errorMessage}`);
        }
      }

      return {
        success: errors.length === 0,
        message: errors.length === 0 
          ? `Successfully synced ${syncedCount} adherence logs`
          : `Synced ${syncedCount} adherence logs with ${errors.length} errors`,
        syncedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Error syncing adherence logs to FHIR:', error);
      return {
        success: false,
        message: 'Failed to sync adherence logs to FHIR store',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Full sync for a user (patient, medications, and adherence)
  async fullUserSync(userId: string): Promise<SyncResult> {
    try {
      const results: SyncResult[] = [];
      
      // Sync user
      const userResult = await this.syncUserToFHIR(userId);
      results.push(userResult);

      // Sync medications
      const medicationResult = await this.syncUserMedicationsToFHIR(userId);
      results.push(medicationResult);

      // Sync adherence logs (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const adherenceResult = await this.syncAdherenceLogsToFHIR(
        userId, 
        thirtyDaysAgo.toISOString()
      );
      results.push(adherenceResult);

      // Aggregate results
      const totalSynced = results.reduce((sum, result) => sum + (result.syncedCount || 0), 0);
      const allErrors = results.flatMap(result => result.errors || []);
      const allSuccessful = results.every(result => result.success);

      return {
        success: allSuccessful,
        message: allSuccessful 
          ? `Full sync completed successfully. Synced ${totalSynced} items.`
          : `Full sync completed with errors. Synced ${totalSynced} items.`,
        syncedCount: totalSynced,
        errors: allErrors.length > 0 ? allErrors : undefined
      };
    } catch (error) {
      console.error('Error during full user sync:', error);
      return {
        success: false,
        message: 'Full sync failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Test FHIR connection
  async testConnection(): Promise<SyncResult> {
    try {
      const isConnected = await googleHealthcareAPI.testConnection();
      return {
        success: isConnected,
        message: isConnected 
          ? 'Successfully connected to Google Cloud Healthcare API'
          : 'Failed to connect to Google Cloud Healthcare API'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connection test failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Get sync status for a user
  async getSyncStatus(userId: string): Promise<{
    patientExists: boolean;
    medicationCount: number;
    adherenceCount: number;
    lastSyncDate?: string;
  }> {
    try {
      // Check if patient exists in FHIR
      let patientExists = false;
      try {
        await googleHealthcareAPI.getPatient(userId);
        patientExists = true;
      } catch {
        patientExists = false;
      }

      // Get medication requests count
      const medicationRequests = await googleHealthcareAPI.getMedicationRequestsByPatient(userId);
      const medicationCount = medicationRequests.length;

      // Get medication statements count
      const medicationStatements = await googleHealthcareAPI.getMedicationStatementsByPatient(userId);
      const adherenceCount = medicationStatements.length;

      return {
        patientExists,
        medicationCount,
        adherenceCount
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        patientExists: false,
        medicationCount: 0,
        adherenceCount: 0
      };
    }
  }
}

// Export singleton instance
export const healthcareSyncService = new HealthcareSyncService();