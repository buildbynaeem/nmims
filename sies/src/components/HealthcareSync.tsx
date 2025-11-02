import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Cloud, CheckCircle, XCircle, RefreshCw, Activity, Info } from 'lucide-react';
import { toast } from 'sonner';
import { healthcareSyncService } from '@/lib/healthcareSync';

interface SyncStatus {
  isConfigured: boolean;
  lastSyncDate?: string;
  patientExists?: boolean;
  medicationCount?: number;
  adherenceCount?: number;
}

export const HealthcareSync: React.FC = () => {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'configured' | 'not_configured'>('unknown');

  // Check configuration on component mount
  useEffect(() => {
    checkConfiguration();
  }, []);

  // Load sync status when user is available and configuration is ready
  useEffect(() => {
    if (user && connectionStatus === 'configured') {
      loadSyncStatus();
    }
  }, [user, connectionStatus]);

  const checkConfiguration = async () => {
    setConnectionStatus('unknown');
    
    // Check if environment variables are configured
    const projectId = import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID;
    const location = import.meta.env.VITE_GOOGLE_CLOUD_LOCATION;
    const datasetId = import.meta.env.VITE_GOOGLE_CLOUD_DATASET_ID;
    const fhirStoreId = import.meta.env.VITE_GOOGLE_CLOUD_FHIR_STORE_ID;

    const isConfigured = !!(projectId && location && datasetId && fhirStoreId);
    
    if (isConfigured) {
      // Test actual connection to healthcare API
      try {
        const connectionResult = await healthcareSyncService.testConnection();
        setConnectionStatus(connectionResult.success ? 'configured' : 'not_configured');
        
        if (!connectionResult.success) {
          toast.error('Healthcare API connection failed: ' + connectionResult.message);
        }
      } catch (error) {
        console.error('Connection test error:', error);
        setConnectionStatus('not_configured');
        toast.error('Failed to test healthcare API connection');
      }
    } else {
      setConnectionStatus('not_configured');
    }
    
    setSyncStatus({
      isConfigured,
      lastSyncDate: isConfigured ? new Date().toISOString() : undefined
    });
  };

  const loadSyncStatus = async () => {
    if (!user?.id) return;
    
    try {
      const status = await healthcareSyncService.getSyncStatus(user.id);
      setSyncStatus(prev => prev ? {
        ...prev,
        patientExists: status.patientExists,
        medicationCount: status.medicationCount,
        adherenceCount: status.adherenceCount,
        lastSyncDate: status.lastSyncDate || prev.lastSyncDate
      } : null);
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    try {
      const result = await healthcareSyncService.testConnection();
      
      if (result.success) {
        toast.success('Healthcare API connection successful!');
        setConnectionStatus('configured');
      } else {
        toast.error('Connection failed: ' + result.message);
        setConnectionStatus('not_configured');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      toast.error('Connection test failed');
      setConnectionStatus('not_configured');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async (syncType: string) => {
    if (connectionStatus !== 'configured' || !user?.id) return;
    
    setIsLoading(true);
    try {
      let result;
      
      switch (syncType) {
         case 'Full': {
           // Perform full sync: user + medications + adherence
           const userResult = await healthcareSyncService.syncUserToFHIR(user.id);
           if (!userResult.success) {
             throw new Error(userResult.message);
           }
           
           const medicationResult = await healthcareSyncService.syncUserMedicationsToFHIR(user.id);
           if (!medicationResult.success) {
             throw new Error(medicationResult.message);
           }
           
           const adherenceResult = await healthcareSyncService.syncAdherenceLogsToFHIR(user.id);
           if (!adherenceResult.success) {
             throw new Error(adherenceResult.message);
           }
           
           result = {
             success: true,
             message: `Full sync completed: ${(userResult.syncedCount || 0) + (medicationResult.syncedCount || 0) + (adherenceResult.syncedCount || 0)} items synced`,
             syncedCount: (userResult.syncedCount || 0) + (medicationResult.syncedCount || 0) + (adherenceResult.syncedCount || 0)
           };
           break;
         }
           
         case 'Medications':
           result = await healthcareSyncService.syncUserMedicationsToFHIR(user.id);
           break;
           
         case 'Adherence':
           result = await healthcareSyncService.syncAdherenceLogsToFHIR(user.id);
           break;
           
         default:
           throw new Error('Unknown sync type');
       }
      
      if (result.success) {
        toast.success(`${syncType} sync completed successfully! ${result.syncedCount || 0} items synced.`);
        setSyncStatus(prev => prev ? {
          ...prev,
          lastSyncDate: new Date().toISOString()
        } : null);
        
        // Reload sync status to get updated counts
        await loadSyncStatus();
      } else {
        toast.error(`${syncType} sync failed: ${result.message}`);
        if (result.errors) {
          result.errors.forEach(error => toast.error(error));
        }
      }
    } catch (error) {
      console.error(`${syncType} sync failed:`, error);
      toast.error(`${syncType} sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'configured':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Configured</Badge>;
      case 'not_configured':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Not Configured</Badge>;
      default:
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Checking...</Badge>;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Please sign in to access healthcare sync features.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Google Cloud Healthcare API
          </CardTitle>
          <CardDescription>
            Sync your medication data with Google Cloud Healthcare FHIR store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Configuration Status:</span>
              {getConnectionBadge()}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkConfiguration}
              disabled={connectionStatus === 'unknown'}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Check Config
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Instructions */}
      {connectionStatus === 'not_configured' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-medium">Healthcare API Not Configured</div>
              <p className="text-sm">To enable healthcare data synchronization, please configure the following environment variables:</p>
              <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                <li>VITE_GOOGLE_CLOUD_PROJECT_ID</li>
                <li>VITE_GOOGLE_CLOUD_LOCATION</li>
                <li>VITE_GOOGLE_CLOUD_DATASET_ID</li>
                <li>VITE_GOOGLE_CLOUD_FHIR_STORE_ID</li>
              </ul>
              <p className="text-sm mt-2">
                <strong>Note:</strong> In production, authentication should be handled by a secure backend service.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Sync Status */}
      {syncStatus?.isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Sync Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {syncStatus?.patientExists ? '✓' : '✗'}
                </div>
                <div className="text-sm text-muted-foreground">Patient Record</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {syncStatus?.medicationCount || 0}
                </div>
                <div className="text-sm text-muted-foreground">Medications</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {syncStatus?.adherenceCount || 0}
                </div>
                <div className="text-sm text-muted-foreground">Adherence Records</div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <div className="text-sm text-muted-foreground">Last Sync</div>
              <div className="text-sm font-medium">
                {syncStatus?.lastSyncDate ? new Date(syncStatus.lastSyncDate).toLocaleString() : 'Never'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Actions</CardTitle>
          <CardDescription>
            Synchronize your data with Google Cloud Healthcare API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              onClick={() => handleTestConnection()}
              disabled={isLoading || connectionStatus !== 'configured'}
              className="w-full"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cloud className="w-4 h-4 mr-2" />}
              Test Connection
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => handleSync('Full')}
              disabled={isLoading || connectionStatus !== 'configured'}
              className="w-full"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Full Sync
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => handleSync('Medications')}
              disabled={isLoading || connectionStatus !== 'configured'}
              className="w-full"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
              Sync Medications
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => handleSync('Adherence')}
              disabled={isLoading || connectionStatus !== 'configured'}
              className="w-full"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Sync Adherence
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">About Healthcare Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              This feature synchronizes your MediGuide data with Google Cloud Healthcare API using FHIR (Fast Healthcare Interoperability Resources) standards.
            </p>
            <p>
              <strong>What gets synced:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Patient information (name, email, ID)</li>
              <li>Medication prescriptions and details</li>
              <li>Medication adherence records</li>
            </ul>
            <p>
              <strong>Benefits:</strong> Standardized healthcare data format, interoperability with other healthcare systems, secure cloud storage.
            </p>
            <p className="text-xs text-amber-600 mt-4">
              <strong>Development Note:</strong> This is a demonstration version. In production, API authentication should be handled by a secure backend service to protect credentials.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthcareSync;