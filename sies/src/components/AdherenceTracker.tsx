import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Calendar, TrendingUp, AlertTriangle, Plus, Bell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase, dbOperations } from "@/lib/supabase";

interface AdherenceLog {
  id: string;
  time: string;
  medication_name: string;
  dosage: string;
  status: "taken" | "missed" | "pending";
  timestamp: Date;
  reminderSent?: boolean;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  startDate: Date;
  endDate?: Date;
}

interface ScheduledDose {
  time: string;
  medication_name: string;
  dosage: string;
  scheduled: boolean;
  food_timing?: string;
}

interface AdherenceTrackerProps {
  scheduledMedications?: ScheduledDose[];
}

export const AdherenceTracker = ({ scheduledMedications = [] }: AdherenceTrackerProps) => {
  const [adherenceLogs, setAdherenceLogs] = useState<AdherenceLog[]>([]);

  const [medications, setMedications] = useState<Medication[]>([]);

  const [newMedication, setNewMedication] = useState({
    name: "",
    dosage: "",
    frequency: "",
    times: [""]
  });

  const [isAddingMedication, setIsAddingMedication] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Convert scheduled medications to adherence logs when they change
  useEffect(() => {
    if (scheduledMedications.length > 0) {
      const newLogs: AdherenceLog[] = scheduledMedications.map((dose, index) => ({
        id: `scheduled_${dose.medication_name}_${dose.time}_${index}`,
        time: dose.time,
        medication_name: dose.medication_name,
        dosage: dose.dosage,
        status: "pending" as const,
        timestamp: new Date(),
        reminderSent: false
      }));
      
      // Merge with existing logs instead of replacing them
      setAdherenceLogs(prev => {
        // Remove any existing scheduled logs to avoid duplicates
        const nonScheduledLogs = prev.filter(log => !log.id.startsWith('scheduled_'));
        // Add new scheduled logs
        return [...nonScheduledLogs, ...newLogs];
      });
      
      toast.success(`Imported ${newLogs.length} scheduled medications to track`);
    }
  }, [scheduledMedications]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const currentTimeStr = now.toTimeString().slice(0, 5);
      
      adherenceLogs.forEach((log) => {
        if (log.status === "pending" && log.time === currentTimeStr && !log.reminderSent) {
          toast.info(`⏰ Time to take ${log.medication_name} ${log.dosage}`, {
            duration: 10000,
            action: {
              label: "Mark as Taken",
              onClick: () => markAsTaken(log.id)
            }
          });
          
          setAdherenceLogs(prev => 
            prev.map(l => l.id === log.id ? { ...l, reminderSent: true } : l)
          );
        }
      });
    };

    const reminderInterval = setInterval(checkReminders, 60000);
    return () => clearInterval(reminderInterval);
  }, [adherenceLogs]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Load adherence logs from database
          const savedLogs = await dbOperations.getAdherenceLogs(user.id);
          if (savedLogs && savedLogs.length > 0) {
            const parsedLogs = savedLogs.map((log: any) => ({
              id: log.id,
              time: new Date(log.scheduled_time).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
              }),
              medication_name: log.medications?.name || 'Unknown',
              dosage: log.medications?.dosage || 'Unknown',
              status: log.status,
              timestamp: new Date(log.scheduled_time),
              reminderSent: false
            }));
            
            // Only load saved logs if no scheduled medications are being passed in
            if (scheduledMedications.length === 0) {
              setAdherenceLogs(parsedLogs);
            }
          }

          // Load medications from database
          const savedMedications = await dbOperations.getUserMedications(user.id);
          if (savedMedications && savedMedications.length > 0) {
            const parsedMedications = savedMedications.map((med: any) => ({
              id: med.id,
              name: med.name,
              dosage: med.dosage,
              frequency: med.frequency,
              times: [], // This would need to be populated from medication_schedules
              startDate: new Date(med.start_date),
              endDate: med.end_date ? new Date(med.end_date) : undefined
            }));
            setMedications(parsedMedications);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [scheduledMedications]);

  useEffect(() => {
    const saveAdherenceLogs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && adherenceLogs.length > 0) {
          // Save adherence logs to database
          for (const log of adherenceLogs) {
            await dbOperations.logAdherence({
              user_id: user.id,
              medication_id: null, // Would need to map medication name to ID
              scheduled_time: log.timestamp.toISOString(),
              actual_time: log.status === 'taken' ? new Date().toISOString() : null,
              status: log.status,
              notes: null
            });
          }
        }
      } catch (error) {
        console.error('Error saving adherence logs:', error);
      }
    };

    if (adherenceLogs.length > 0) {
      saveAdherenceLogs();
    }
  }, [adherenceLogs]);

  useEffect(() => {
    const saveMedications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && medications.length > 0) {
          // Save medications to database
          for (const med of medications) {
            await dbOperations.createMedication({
              user_id: user.id,
              name: med.name,
              dosage: med.dosage,
              frequency: med.frequency,
              times_per_day: med.times.length,
              start_date: med.startDate.toISOString().split('T')[0],
              end_date: med.endDate?.toISOString().split('T')[0] || null,
              is_active: true
            });
          }
        }
      } catch (error) {
        console.error('Error saving medications:', error);
      }
    };

    if (medications.length > 0) {
      saveMedications();
    }
  }, [medications]);

  const markAsTaken = (id: string) => {
    const updated = adherenceLogs.map(log => 
      log.id === id ? { ...log, status: "taken" as const } : log
    );
    setAdherenceLogs(updated);
    const medication = updated.find(log => log.id === id);
    if (medication) {
      toast.success(`Marked ${medication.medication_name} as taken`);
    }
  };

  const markAsMissed = (id: string) => {
    const updated = adherenceLogs.map(log => 
      log.id === id ? { ...log, status: "missed" as const } : log
    );
    setAdherenceLogs(updated);
    const medication = updated.find(log => log.id === id);
    if (medication) {
      toast.error(`Marked ${medication.medication_name} as missed`);
    }
  };

  const addMedication = () => {
    if (!newMedication.name || !newMedication.dosage) {
      toast.error("Please fill in medication name and dosage");
      return;
    }

    const medication: Medication = {
      id: `med${Date.now()}`,
      name: newMedication.name,
      dosage: newMedication.dosage,
      frequency: newMedication.frequency,
      times: newMedication.times.filter(time => time.trim() !== ""),
      startDate: new Date()
    };

    setMedications(prev => [...prev, medication]);
    
    const newLogs: AdherenceLog[] = medication.times.map(time => ({
      id: `log${Date.now()}_${time}`,
      time,
      medication_name: medication.name,
      dosage: medication.dosage,
      status: "pending" as const,
      timestamp: new Date()
    }));

    setAdherenceLogs(prev => [...prev, ...newLogs]);
    
    setNewMedication({ name: "", dosage: "", frequency: "", times: [""] });
    setIsAddingMedication(false);
    toast.success(`Added ${medication.name} to your medication list`);
  };

  const deleteMedication = (medicationId: string) => {
    const medication = medications.find(med => med.id === medicationId);
    if (!medication) return;

    setMedications(prev => prev.filter(med => med.id !== medicationId));
    setAdherenceLogs(prev => prev.filter(log => log.medication_name !== medication.name));
    toast.success(`Removed ${medication.name} from your medication list`);
  };

  const addTimeSlot = () => {
    setNewMedication(prev => ({
      ...prev,
      times: [...prev.times, ""]
    }));
  };

  const updateTimeSlot = (index: number, value: string) => {
    setNewMedication(prev => ({
      ...prev,
      times: prev.times.map((time, i) => i === index ? value : time)
    }));
  };

  const removeTimeSlot = (index: number) => {
    setNewMedication(prev => ({
      ...prev,
      times: prev.times.filter((_, i) => i !== index)
    }));
  };

  const calculateAdherence = () => {
    const completedDoses = adherenceLogs.filter(log => log.status === "taken").length;
    const totalDoses = adherenceLogs.filter(log => log.status !== "pending").length;
    return totalDoses > 0 ? Math.round((completedDoses / totalDoses) * 100) : 0;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "taken":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "missed":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "pending":
        return <Clock className="h-5 w-5 text-warning" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "taken":
        return <Badge className="bg-success/10 text-success border-success/20">Taken</Badge>;
      case "missed":
        return <Badge variant="destructive">Missed</Badge>;
      case "pending":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      default:
        return null;
    }
  };

  const adherencePercent = calculateAdherence();
  const pendingDoses = adherenceLogs.filter(log => log.status === "pending");

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{currentTime.toLocaleTimeString()}</div>
                <div className="text-sm text-muted-foreground">{currentTime.toLocaleDateString()}</div>
              </div>
            </div>
            <Dialog open={isAddingMedication} onOpenChange={setIsAddingMedication}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Medication
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Medication</DialogTitle>
                  <DialogDescription>
                    Add a new medication to your tracking schedule
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Medication Name</Label>
                    <Input
                      id="name"
                      value={newMedication.name}
                      onChange={(e) => setNewMedication(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Metformin"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dosage">Dosage</Label>
                    <Input
                      id="dosage"
                      value={newMedication.dosage}
                      onChange={(e) => setNewMedication(prev => ({ ...prev, dosage: e.target.value }))}
                      placeholder="e.g., 500mg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="frequency">Frequency</Label>
                    <Input
                      id="frequency"
                      value={newMedication.frequency}
                      onChange={(e) => setNewMedication(prev => ({ ...prev, frequency: e.target.value }))}
                      placeholder="e.g., Twice daily"
                    />
                  </div>
                  <div>
                    <Label>Times</Label>
                    {newMedication.times.map((time, index) => (
                      <div key={index} className="flex gap-2 mt-2">
                        <Input
                          type="time"
                          value={time}
                          onChange={(e) => updateTimeSlot(index, e.target.value)}
                        />
                        {newMedication.times.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeTimeSlot(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTimeSlot}
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Time
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingMedication(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addMedication}>Add Medication</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold">{adherencePercent}%</div>
                <div className="text-sm text-muted-foreground">Adherence Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {adherenceLogs.filter(log => log.status === "taken").length}
                </div>
                <div className="text-sm text-muted-foreground">Doses Taken</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-warning/10 rounded-lg">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <div className="text-2xl font-bold">{pendingDoses.length}</div>
                <div className="text-sm text-muted-foreground">Pending Doses</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {pendingDoses.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Pending Doses
            </CardTitle>
            <CardDescription>
              You have {pendingDoses.length} dose(s) pending confirmation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingDoses.map((dose) => (
                <div key={dose.id} className="flex items-center justify-between p-4 bg-card border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Clock className="h-5 w-5 text-warning" />
                    <div>
                      <div className="font-medium">{dose.medication_name} {dose.dosage}</div>
                      <div className="text-sm text-muted-foreground">
                        Due at {dose.time} • {dose.timestamp.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => markAsTaken(dose.id)}
                      className="gap-2"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Taken
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => markAsMissed(dose.id)}
                      className="gap-2"
                    >
                      <XCircle className="h-3 w-3" />
                      Missed
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Adherence History
          </CardTitle>
          <CardDescription>
            Track your medication adherence over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Adherence</span>
                <span>{adherencePercent}%</span>
              </div>
              <Progress value={adherencePercent} className="h-2" />
            </div>

            <div className="space-y-3">
              {adherenceLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="font-medium">{log.medication_name} {log.dosage}</div>
                      <div className="text-sm text-muted-foreground">
                        {log.timestamp.toLocaleDateString()} at {log.time}
                      </div>
                    </div>
                  </div>
                  
                  {getStatusBadge(log.status)}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Medication adherence is important for your health. If you're having trouble remembering doses, 
          consider setting up additional reminders or consulting with your healthcare provider.
        </AlertDescription>
      </Alert>
    </div>
  );
};