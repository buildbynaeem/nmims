import React from 'react';
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import HealthcareSync from '../components/HealthcareSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Cloud, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const HealthcareSyncPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <Cloud className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Healthcare Data Sync
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Synchronize your medication data with Google Cloud Healthcare API using FHIR standards
          </p>
        </div>

        {/* Content */}
        <SignedOut>
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Cloud className="w-6 h-6" />
                Healthcare Sync
              </CardTitle>
              <CardDescription>
                Sign in to access healthcare data synchronization features
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <SignInButton mode="modal">
                <Button className="w-full">
                  Sign In to Continue
                </Button>
              </SignInButton>
            </CardContent>
          </Card>
        </SignedOut>

        <SignedIn>
          <HealthcareSync />
        </SignedIn>
      </div>
    </div>
  );
};

export default HealthcareSyncPage;