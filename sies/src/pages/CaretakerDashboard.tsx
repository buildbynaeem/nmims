import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ThemeToggleButton from "@/components/ui/theme-toggle-button";
import { CaretakerDashboard as CaretakerDashboardComponent } from "@/components/CaretakerDashboard";

const CaretakerDashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to MediGuide
                </Button>
              </Link>
              <div className="h-6 w-px bg-border mx-2" />
              <div className="flex items-center gap-3">
                <img 
                  src="/mediguide-logo.svg" 
                  alt="MediGuide Logo" 
                  className="h-10 w-auto"
                />
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-medical-green bg-clip-text text-transparent">
                    Caretaker Portal
                  </h1>
                  <p className="text-sm text-muted-foreground">Monitor and support medication adherence</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggleButton />
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <CaretakerDashboardComponent />
    </div>
  );
};

export default CaretakerDashboard;