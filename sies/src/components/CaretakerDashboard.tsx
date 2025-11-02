import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Heart,
  Phone,
  MessageCircle,
  Bell,
  User,
  Pill
} from "lucide-react";

interface MedicationStatus {
  id: string;
  name: string;
  dosage: string;
  nextDue: string;
  status: "taken" | "missed" | "upcoming";
  adherenceRate: number;
}

interface PatientInfo {
  name: string;
  age: number;
  avatar?: string;
  lastActive: string;
  overallAdherence: number;
}

export const CaretakerDashboard = () => {
  const [patient] = useState<PatientInfo>({
    name: "",
    age: 0,
    lastActive: "",
    overallAdherence: 0
  });

  const [medications] = useState<MedicationStatus[]>([]);

  const [alerts] = useState([]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "taken":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "missed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "upcoming":
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "taken":
        return <Badge className="bg-success/10 text-success border-success/20">Taken</Badge>;
      case "missed":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Missed</Badge>;
      case "upcoming":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Upcoming</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getAdherenceColor = (rate: number) => {
    if (rate >= 90) return "text-success";
    if (rate >= 75) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Caretaker Dashboard</h1>
          <p className="text-muted-foreground">Monitor and support your care recipient's medication journey</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Phone className="h-4 w-4" />
            Call Patient
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Send Message
          </Button>
        </div>
      </div>

      {/* Patient Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Patient Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src="" />
                <AvatarFallback className="text-lg">
                  {patient.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">{patient.name}</h3>
                <p className="text-muted-foreground">Age: {patient.age}</p>
                <p className="text-sm text-muted-foreground">Last active: {patient.lastActive}</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Overall Adherence</span>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={patient.overallAdherence} className="w-32" />
                <span className={`text-2xl font-bold ${getAdherenceColor(patient.overallAdherence)}`}>
                  {patient.overallAdherence}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <Alert key={alert.id} className={
                  alert.severity === "high" ? "border-destructive/50 bg-destructive/5" : 
                  alert.severity === "medium" ? "border-warning/50 bg-warning/5" :
                  "border-success/50 bg-success/5"
                }>
                  <Bell className="h-4 w-4" />
                  <AlertDescription className="flex justify-between items-center">
                    <span>{alert.message}</span>
                    <span className="text-xs text-muted-foreground">{alert.time}</span>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Medications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            Today's Medication Status
          </CardTitle>
          <CardDescription>
            Track all scheduled medications for today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {medications.map((medication) => (
              <div key={medication.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  {getStatusIcon(medication.status)}
                  <div>
                    <div className="font-medium">{medication.name}</div>
                    <div className="text-sm text-muted-foreground">{medication.dosage}</div>
                    <div className="text-xs text-muted-foreground">
                      {medication.status === "upcoming" ? `Due: ${medication.nextDue}` : 
                       medication.status === "missed" ? `Was due: ${medication.nextDue}` :
                       `Taken on time`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">Adherence Rate</div>
                    <div className={`text-lg font-bold ${getAdherenceColor(medication.adherenceRate)}`}>
                      {medication.adherenceRate}%
                    </div>
                  </div>
                  {getStatusBadge(medication.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Weekly Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Doses Taken</span>
                <span className="font-medium">18/21</span>
              </div>
              <Progress value={85} />
              
              <div className="flex justify-between items-center">
                <span className="text-sm">On-Time Rate</span>
                <span className="font-medium">16/18</span>
              </div>
              <Progress value={89} />

              <div className="flex justify-between items-center">
                <span className="text-sm">Missed Doses</span>
                <span className="font-medium text-destructive">3</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div>
                  <div className="font-medium">Lisinopril 10mg</div>
                  <div className="text-sm text-muted-foreground">Evening dose</div>
                </div>
                <span className="text-sm font-medium">6:00 PM</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div>
                  <div className="font-medium">Metformin 500mg</div>
                  <div className="text-sm text-muted-foreground">Tomorrow morning</div>
                </div>
                <span className="text-sm font-medium">8:00 AM</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div>
                  <div className="font-medium">Atorvastatin 20mg</div>
                  <div className="text-sm text-muted-foreground">Tomorrow evening</div>
                </div>
                <span className="text-sm font-medium">8:00 PM</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" className="gap-2">
              <Bell className="h-4 w-4" />
              Send Reminder
            </Button>
            <Button variant="outline" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Check In
            </Button>
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              View Full Schedule
            </Button>
            <Button variant="outline" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              View Reports
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};