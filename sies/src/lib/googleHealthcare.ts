// Browser-compatible Google Cloud Healthcare API client
// Note: In production, authentication should be handled by a backend service
// This is a simplified version for demonstration purposes

// Configuration from environment variables
const config = {
  projectId: import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID || 'mediguide-health-api',
  location: import.meta.env.VITE_GOOGLE_CLOUD_LOCATION || 'us-central1',
  datasetId: import.meta.env.VITE_GOOGLE_CLOUD_DATASET_ID || 'mediguide-dataset',
  fhirStoreId: import.meta.env.VITE_GOOGLE_CLOUD_FHIR_STORE_ID || 'mediguide-fhir-store'
};

// FHIR store path
const FHIR_STORE_PATH = `projects/${config.projectId}/locations/${config.location}/datasets/${config.datasetId}/fhirStores/${config.fhirStoreId}`;

// Browser-compatible HTTP client for FHIR operations
const fhirClient = {
  baseUrl: `https://healthcare.googleapis.com/v1/${FHIR_STORE_PATH}/fhir`,
  
  async request(method: string, path: string, data?: FHIRPatient | FHIRMedication | FHIRMedicationRequest | FHIRMedicationStatement | Record<string, unknown>) {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/fhir+json',
        // In production, use proper authentication
        // 'Authorization': `Bearer ${accessToken}`
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
};

// FHIR Resource Types
export interface FHIRPatient {
  resourceType: 'Patient';
  id?: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  name?: Array<{
    family: string;
    given: string[];
  }>;
  telecom?: Array<{
    system: 'phone' | 'email';
    value: string;
  }>;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
}

export interface FHIRMedication {
  resourceType: 'Medication';
  id?: string;
  code?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  form?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  extension?: Array<{
    url: string;
    valueString?: string;
    valueCodeableConcept?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
      text: string;
    };
  }>;
  // Side effects information
  sideEffects?: Array<{
    effect: string;
    severity: 'mild' | 'moderate' | 'severe';
    frequency: 'common' | 'uncommon' | 'rare' | 'very-rare';
    description?: string;
  }>;
}

export interface FHIRMedicationRequest {
  resourceType: 'MedicationRequest';
  id?: string;
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  medicationReference?: {
    reference: string;
  };
  subject: {
    reference: string;
  };
  dosageInstruction?: Array<{
    text?: string;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: 'h' | 'd' | 'wk' | 'mo' | 'a';
      };
    };
    doseAndRate?: Array<{
      doseQuantity?: {
        value: number;
        unit: string;
      };
    }>;
  }>;
}

export interface FHIRMedicationStatement {
  resourceType: 'MedicationStatement';
  id?: string;
  status: 'active' | 'completed' | 'entered-in-error' | 'intended' | 'stopped' | 'on-hold' | 'unknown' | 'not-taken';
  medicationReference?: {
    reference: string;
  };
  subject: {
    reference: string;
  };
  effectiveDateTime?: string;
  dateAsserted?: string;
  dosage?: Array<{
    text?: string;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: 'h' | 'd' | 'wk' | 'mo' | 'a';
      };
    };
  }>;
}

// Google Cloud Healthcare API operations
export class GoogleHealthcareAPI {
  
  // Create a new patient in FHIR store
  async createPatient(patient: FHIRPatient): Promise<FHIRPatient> {
    try {
      const response = await fhirClient.request('POST', '/Patient', patient);
      return response as FHIRPatient;
    } catch (error) {
      console.error('Error creating patient:', error);
      throw new Error('Failed to create patient in FHIR store');
    }
  }

  // Get patient by ID
  async getPatient(patientId: string): Promise<FHIRPatient> {
    try {
      const response = await fhirClient.request('GET', `/Patient/${patientId}`);
      return response as FHIRPatient;
    } catch (error) {
      console.error('Error getting patient:', error);
      throw new Error('Failed to retrieve patient from FHIR store');
    }
  }

  // Create a medication resource
  async createMedication(medication: FHIRMedication): Promise<FHIRMedication> {
    try {
      const response = await fhirClient.request('POST', '/Medication', medication);
      return response as FHIRMedication;
    } catch (error) {
      console.error('Error creating medication:', error);
      throw new Error('Failed to create medication in FHIR store');
    }
  }

  // Create a medication request (prescription)
  async createMedicationRequest(medicationRequest: FHIRMedicationRequest): Promise<FHIRMedicationRequest> {
    try {
      const response = await fhirClient.request('POST', '/MedicationRequest', medicationRequest);
      return response as FHIRMedicationRequest;
    } catch (error) {
      console.error('Error creating medication request:', error);
      throw new Error('Failed to create medication request in FHIR store');
    }
  }

  // Create a medication statement (adherence record)
  async createMedicationStatement(medicationStatement: FHIRMedicationStatement): Promise<FHIRMedicationStatement> {
    try {
      const response = await fhirClient.request('POST', '/MedicationStatement', medicationStatement);
      return response as FHIRMedicationStatement;
    } catch (error) {
      console.error('Error creating medication statement:', error);
      throw new Error('Failed to create medication statement in FHIR store');
    }
  }

  // Search for medication requests by patient
  async getMedicationRequestsByPatient(patientId: string): Promise<FHIRMedicationRequest[]> {
    try {
      const response = await fhirClient.request('GET', `/MedicationRequest?subject=Patient/${patientId}`);
      const bundle = response as { entry?: Array<{ resource: FHIRMedicationRequest }> };
      return bundle.entry ? bundle.entry.map((entry) => entry.resource) : [];
    } catch (error) {
      console.error('Error searching medication requests:', error);
      throw new Error('Failed to search medication requests in FHIR store');
    }
  }

  // Search for medication statements by patient
  async getMedicationStatementsByPatient(patientId: string): Promise<FHIRMedicationStatement[]> {
    try {
      const response = await fhirClient.request('GET', `/MedicationStatement?subject=Patient/${patientId}`);
      const bundle = response as { entry?: Array<{ resource: FHIRMedicationStatement }> };
      return bundle.entry ? bundle.entry.map((entry) => entry.resource) : [];
    } catch (error) {
      console.error('Error searching medication statements:', error);
      throw new Error('Failed to search medication statements in FHIR store');
    }
  }

  // Update patient information
  async updatePatient(patientId: string, patient: Partial<FHIRPatient>): Promise<FHIRPatient> {
    try {
      const response = await fhirClient.request('PUT', `/Patient/${patientId}`, { ...patient, resourceType: 'Patient', id: patientId });
      return response as FHIRPatient;
    } catch (error) {
      console.error('Error updating patient:', error);
      throw new Error('Failed to update patient in FHIR store');
    }
  }

  // Delete a resource
  async deleteResource(resourceType: string, resourceId: string): Promise<void> {
    try {
      await fhirClient.request('DELETE', `/${resourceType}/${resourceId}`);
    } catch (error) {
      console.error('Error deleting resource:', error);
      throw new Error(`Failed to delete ${resourceType} from FHIR store`);
    }
  }

  // Get medication with side effects information
  async getMedicationWithSideEffects(medicationId: string): Promise<FHIRMedication> {
    try {
      const response = await fhirClient.request('GET', `/Medication/${medicationId}`);
      const medication = response as FHIRMedication;
      
      // Enhance with side effects data if not already present
      if (!medication.sideEffects && medication.code?.coding?.[0]?.code) {
        medication.sideEffects = await this.fetchSideEffectsData(medication.code.coding[0].code, medication.code.text);
      }
      
      return medication;
    } catch (error) {
      console.error('Error getting medication with side effects:', error);
      throw new Error('Failed to retrieve medication with side effects from FHIR store');
    }
  }

  // Fetch side effects data for a medication
  private async fetchSideEffectsData(medicationCode: string, medicationName: string): Promise<Array<{
    effect: string;
    severity: 'mild' | 'moderate' | 'severe';
    frequency: 'common' | 'uncommon' | 'rare' | 'very-rare';
    description?: string;
  }>> {
    // This is a mock implementation - in a real scenario, you would integrate with
    // a drug information API like FDA OpenFDA, RxNorm, or a commercial drug database
    const commonSideEffects = this.getCommonSideEffectsByMedicationType(medicationName);
    
    return commonSideEffects;
  }

  // Get common side effects based on medication type/name
  private getCommonSideEffectsByMedicationType(medicationName: string): Array<{
    effect: string;
    severity: 'mild' | 'moderate' | 'severe';
    frequency: 'common' | 'uncommon' | 'rare' | 'very-rare';
    description?: string;
  }> {
    const name = medicationName.toLowerCase();
    
    // Common medication categories and their typical side effects
    if (name.includes('ibuprofen') || name.includes('aspirin') || name.includes('naproxen')) {
      return [
        { effect: 'Stomach upset', severity: 'mild', frequency: 'common', description: 'May cause nausea or stomach irritation' },
        { effect: 'Drowsiness', severity: 'mild', frequency: 'uncommon', description: 'May cause mild drowsiness' },
        { effect: 'Allergic reaction', severity: 'severe', frequency: 'rare', description: 'Seek immediate medical attention if rash or difficulty breathing occurs' }
      ];
    }
    
    if (name.includes('acetaminophen') || name.includes('paracetamol')) {
      return [
        { effect: 'Liver damage', severity: 'severe', frequency: 'rare', description: 'Risk increases with high doses or alcohol use' },
        { effect: 'Nausea', severity: 'mild', frequency: 'uncommon', description: 'May cause mild nausea' }
      ];
    }
    
    if (name.includes('amoxicillin') || name.includes('penicillin')) {
      return [
        { effect: 'Diarrhea', severity: 'mild', frequency: 'common', description: 'May cause loose stools' },
        { effect: 'Allergic reaction', severity: 'severe', frequency: 'uncommon', description: 'Can cause serious allergic reactions in sensitive individuals' },
        { effect: 'Nausea', severity: 'mild', frequency: 'common', description: 'May cause stomach upset' }
      ];
    }
    
    if (name.includes('metformin')) {
      return [
        { effect: 'Gastrointestinal upset', severity: 'mild', frequency: 'common', description: 'May cause nausea, diarrhea, or stomach pain' },
        { effect: 'Metallic taste', severity: 'mild', frequency: 'common', description: 'May cause metallic taste in mouth' },
        { effect: 'Lactic acidosis', severity: 'severe', frequency: 'very-rare', description: 'Rare but serious condition requiring immediate medical attention' }
      ];
    }
    
    if (name.includes('lisinopril') || name.includes('enalapril')) {
      return [
        { effect: 'Dry cough', severity: 'mild', frequency: 'common', description: 'Persistent dry cough is common' },
        { effect: 'Dizziness', severity: 'mild', frequency: 'common', description: 'May cause dizziness, especially when standing up' },
        { effect: 'Hyperkalemia', severity: 'moderate', frequency: 'uncommon', description: 'May increase potassium levels' }
      ];
    }
    
    // Default side effects for unknown medications
    return [
      { effect: 'Nausea', severity: 'mild', frequency: 'common', description: 'May cause stomach upset' },
      { effect: 'Dizziness', severity: 'mild', frequency: 'uncommon', description: 'May cause mild dizziness' },
      { effect: 'Allergic reaction', severity: 'moderate', frequency: 'rare', description: 'Contact healthcare provider if unusual symptoms occur' }
    ];
  }

  // Test connection to FHIR store
  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple metadata request
      await fhirClient.request('GET', '/metadata');
      return true;
    } catch (error) {
      console.error('FHIR store connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const googleHealthcareAPI = new GoogleHealthcareAPI();

// Utility functions for converting between MediGuide and FHIR formats
export const FHIRConverters = {
  // Convert MediGuide user to FHIR Patient
  userToFHIRPatient: (user: { id: string; full_name?: string; email: string }): FHIRPatient => ({
    resourceType: 'Patient',
    identifier: [{
      system: 'mediguide-user-id',
      value: user.id
    }],
    name: [{
      family: user.full_name?.split(' ').pop() || '',
      given: user.full_name?.split(' ').slice(0, -1) || []
    }],
    telecom: [{
      system: 'email',
      value: user.email
    }]
  }),

  // Convert MediGuide medication to FHIR Medication
  medicationToFHIRMedication: (medication: { id: string; name: string; dosage: string }): FHIRMedication => ({
    resourceType: 'Medication',
    code: {
      coding: [{
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: medication.id,
        display: medication.name
      }],
      text: medication.name
    },
    form: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '385055001',
        display: medication.dosage
      }]
    }
  }),

  // Convert MediGuide medication to FHIR MedicationRequest
  medicationToFHIRRequest: (medication: { 
    id: string; 
    is_active: boolean; 
    dosage: string; 
    frequency: string; 
    times_per_day: number 
  }, patientId: string): FHIRMedicationRequest => ({
    resourceType: 'MedicationRequest',
    status: medication.is_active ? 'active' : 'stopped',
    intent: 'order',
    medicationReference: {
      reference: `Medication/${medication.id}`
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    dosageInstruction: [{
      text: `${medication.dosage} ${medication.frequency}`,
      timing: {
        repeat: {
          frequency: medication.times_per_day,
          period: 1,
          periodUnit: 'd'
        }
      }
    }]
  }),

  // Convert adherence log to FHIR MedicationStatement
  adherenceToFHIRStatement: (adherence: {
    status: string;
    medication_id: string;
    actual_time?: string;
    scheduled_time: string;
    created_at: string;
  }, patientId: string): FHIRMedicationStatement => ({
    resourceType: 'MedicationStatement',
    status: adherence.status === 'taken' ? 'completed' : 'not-taken',
    medicationReference: {
      reference: `Medication/${adherence.medication_id}`
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    effectiveDateTime: adherence.actual_time || adherence.scheduled_time,
    dateAsserted: adherence.created_at
  })
};