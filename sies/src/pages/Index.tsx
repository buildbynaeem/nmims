import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrescriptionDecoder } from "@/components/PrescriptionDecoder";
import { MedicationScheduler } from "@/components/MedicationScheduler";
import { AdherenceTracker } from "@/components/AdherenceTracker";
import { CareCircle } from "@/components/CareCircle";
import ThemeToggleButton from "@/components/ui/theme-toggle-button";
import { Pill, Clock, Users, FileText, Shield, Heart, Cloud } from "lucide-react";
import { supabase, dbOperations } from "@/lib/supabase";
import { Link } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";

const Index = () => {
  const [decodedMedications, setDecodedMedications] = useState([]);
  const [scheduledMedications, setScheduledMedications] = useState([]);

  // Load scheduled medications from database on component mount
  useEffect(() => {
    const loadScheduledMedications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const savedMedications = await dbOperations.getScheduledMedications(user.id);
          if (savedMedications && savedMedications.length > 0) {
            setScheduledMedications(savedMedications);
          }
        }
      } catch (error) {
        console.error('Error loading scheduled medications:', error);
      }
    };

    loadScheduledMedications();
  }, []);

  // Save scheduled medications to database when they change
  useEffect(() => {
    const saveScheduledMedications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && scheduledMedications.length >= 0) {
          await dbOperations.saveScheduledMedications(user.id, scheduledMedications);
        }
      } catch (error) {
        console.error('Error saving scheduled medications:', error);
      }
    };

    if (scheduledMedications.length > 0) {
      saveScheduledMedications();
    }
  }, [scheduledMedications]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/mediguide-logo.svg" 
                alt="MediGuide Logo" 
                className="h-12 w-auto"
              />
              <div>
                <p className="text-sm text-muted-foreground">Your medication companion</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggleButton />
              <SignedIn>
                <Link to="/healthcare-sync">
                  <Button variant="outline" className="gap-2">
                    <Cloud className="h-4 w-4" />
                    Healthcare Sync
                  </Button>
                </Link>
              </SignedIn>
              <SignedOut>
                <SignInButton>
                  <Button variant="outline">Sign In</Button>
                </SignInButton>
                <SignUpButton>
                  <Button>Sign Up</Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
              <Button variant="outline" className="gap-2">
                <Shield className="h-4 w-4" />
                HIPAA Compliant
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-medical-green bg-clip-text text-transparent">
            Understand Your Prescriptions
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Transform complex medical instructions into clear, actionable guidance. 
            Stay connected with your care team and never miss a dose.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="text-center p-6 rounded-xl bg-card border shadow-soft">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Decode Prescriptions</h3>
              <p className="text-sm text-muted-foreground">
                Convert medical jargon into plain English instructions
              </p>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-card border shadow-soft">
              <div className="w-12 h-12 bg-medical-green/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Clock className="h-6 w-6 text-medical-green" />
              </div>
              <h3 className="font-semibold mb-2">Smart Scheduling</h3>
              <p className="text-sm text-muted-foreground">
                Automatic medication reminders and adherence tracking
              </p>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-card border shadow-soft">
              <div className="w-12 h-12 bg-accent/60 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="font-semibold mb-2">Care Circle</h3>
              <p className="text-sm text-muted-foreground">
                Keep family and caregivers informed and involved
              </p>
            </div>
          </div>
        </div>

        {/* Main Interface */}
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="decode" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="decode" className="gap-2">
                <FileText className="h-4 w-4" />
                Decode
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-2">
                <Clock className="h-4 w-4" />
                Schedule
              </TabsTrigger>
              <TabsTrigger value="track" className="gap-2">
                <Pill className="h-4 w-4" />
                Track
              </TabsTrigger>
              <TabsTrigger value="care" className="gap-2">
                <Users className="h-4 w-4" />
                Care Circle
              </TabsTrigger>
            </TabsList>

            <TabsContent value="decode" className="animate-fade-in">
              <PrescriptionDecoder 
                onMedicationsDecoded={setDecodedMedications}
              />
            </TabsContent>

            <TabsContent value="schedule" className="animate-fade-in">
              <MedicationScheduler 
                medications={decodedMedications}
                onScheduleGenerated={setScheduledMedications}
              />
            </TabsContent>

            <TabsContent value="track" className="animate-fade-in">
              <AdherenceTracker 
                scheduledMedications={scheduledMedications}
              />
            </TabsContent>

            <TabsContent value="care" className="animate-fade-in">
              <CareCircle />
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
};

export default Index;