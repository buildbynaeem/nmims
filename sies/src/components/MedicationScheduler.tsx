import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Clock, Plus, Trash2, Bell, BellRing, Check, AlertCircle, ChevronDown, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { googleHealthcareAPI } from '@/lib/googleHealthcare';

// Extend Window interface for TypeScript
declare global {
  interface Window {
    medicationTimeouts?: NodeJS.Timeout[];
  }
}

interface Medication {
  medication_name: string;
  dosage: string;
  frequency: string;
  times_per_day: number;
  plain_english: string;
  food_timing?: string; // "before_food", "after_food", "with_food", or "anytime"
  sideEffects?: Array<{
    effect: string;
    severity: 'mild' | 'moderate' | 'severe';
    frequency: 'common' | 'uncommon' | 'rare' | 'very-rare';
    description?: string;
  }>;
}

interface ScheduledDose {
  time: string;
  medication_name: string;
  dosage: string;
  scheduled: boolean;
  food_timing?: string;
  sideEffects?: Array<{
    effect: string;
    severity: 'mild' | 'moderate' | 'severe';
    frequency: 'common' | 'uncommon' | 'rare' | 'very-rare';
    description?: string;
  }>;
}

interface MedicationSchedulerProps {
  medications: Medication[];
  onScheduleGenerated?: (schedule: ScheduledDose[]) => void;
}

export const MedicationScheduler = ({ medications, onScheduleGenerated }: MedicationSchedulerProps) => {
  const [scheduledDoses, setScheduledDoses] = useState<ScheduledDose[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [allRemindersSet, setAllRemindersSet] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [medicationsWithSideEffects, setMedicationsWithSideEffects] = useState<Medication[]>([]);
  const [loadingSideEffects, setLoadingSideEffects] = useState(false);

  // Check notification permission on component mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Load side effects for medications
  useEffect(() => {
    const loadSideEffects = async () => {
      if (medications.length === 0) return;
      
      setLoadingSideEffects(true);
      try {
        const medicationsWithEffects = await Promise.all(
          medications.map(async (med) => {
            try {
              // Use the healthcare API to get side effects
              const sideEffects = await googleHealthcareAPI['getCommonSideEffectsByMedicationType']?.(med.medication_name) || 
                                  getDefaultSideEffects(med.medication_name);
              return { ...med, sideEffects };
            } catch (error) {
              console.warn(`Failed to load side effects for ${med.medication_name}:`, error);
              return { ...med, sideEffects: getDefaultSideEffects(med.medication_name) };
            }
          })
        );
        setMedicationsWithSideEffects(medicationsWithEffects);
      } catch (error) {
        console.error('Error loading side effects:', error);
        setMedicationsWithSideEffects(medications.map(med => ({ ...med, sideEffects: getDefaultSideEffects(med.medication_name) })));
      } finally {
        setLoadingSideEffects(false);
      }
    };

    loadSideEffects();
  }, [medications]);

  // Default side effects for fallback
  const getDefaultSideEffects = (medicationName: string) => {
    const name = medicationName.toLowerCase();
    
    if (name.includes('ibuprofen') || name.includes('aspirin') || name.includes('naproxen')) {
      return [
        { effect: 'Stomach upset', severity: 'mild' as const, frequency: 'common' as const, description: 'May cause nausea or stomach irritation' },
        { effect: 'Drowsiness', severity: 'mild' as const, frequency: 'uncommon' as const, description: 'May cause mild drowsiness' },
        { effect: 'Allergic reaction', severity: 'severe' as const, frequency: 'rare' as const, description: 'Seek immediate medical attention if rash or difficulty breathing occurs' }
      ];
    }
    
    return [
      { effect: 'Nausea', severity: 'mild' as const, frequency: 'common' as const, description: 'May cause stomach upset' },
      { effect: 'Dizziness', severity: 'mild' as const, frequency: 'uncommon' as const, description: 'May cause mild dizziness' },
      { effect: 'Allergic reaction', severity: 'moderate' as const, frequency: 'rare' as const, description: 'Contact healthcare provider if unusual symptoms occur' }
    ];
  };

  // Get severity color for badges
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'mild': return 'bg-green-100 text-green-800 border-green-200';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'severe': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get side effect badge color variant
  const getSideEffectBadgeColor = (severity: 'mild' | 'moderate' | 'severe') => {
    switch (severity) {
      case 'mild': return 'secondary';
      case 'moderate': return 'default';
      case 'severe': return 'destructive';
      default: return 'outline';
    }
  };

  // Get frequency color for badges
  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'common': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'uncommon': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'rare': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'very-rare': return 'bg-pink-100 text-pink-800 border-pink-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Schedule notifications for all doses
  const scheduleNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error('This browser does not support notifications');
      return;
    }

    if (notificationPermission !== 'granted') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission !== 'granted') {
        toast.error("Notifications permission denied. Please enable notifications in your browser settings.");
        return;
      }
    }

    // Clear any existing timeouts
    if (window.medicationTimeouts) {
      window.medicationTimeouts.forEach(timeout => clearTimeout(timeout));
    }
    window.medicationTimeouts = [];

    // Schedule notifications for all doses
    scheduledDoses.forEach((dose, index) => {
      const [hours, minutes] = dose.time.split(':').map(Number);
      const now = new Date();
      const notificationTime = new Date();
      notificationTime.setHours(hours, minutes, 0, 0);
      
      // If the time has passed today, schedule for tomorrow
      if (notificationTime <= now) {
        notificationTime.setDate(notificationTime.getDate() + 1);
      }
      
      const timeUntilNotification = notificationTime.getTime() - now.getTime();
      
      const timeoutId = setTimeout(() => {
        // Create notification
        const notification = new Notification(`🔔 Medication Reminder`, {
          body: `Time to take ${dose.medication_name} (${dose.dosage})${dose.food_timing ? `\n${getFoodTimingText(dose.food_timing)}` : ''}`,
          icon: '/logo.png',
          tag: `medication-${index}`,
          requireInteraction: true,
          silent: false
        });
        
        // Handle notification click
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        
        // Auto-close after 30 seconds
        setTimeout(() => notification.close(), 30000);
        
        // Play notification sound
        try {
          const audio = new Audio();
          audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTuR2O/Eeyw';
          audio.volume = 0.5;
          audio.play().catch(() => {}); // Ignore errors if audio fails
        } catch (error) {
          console.log('Audio notification not supported');
        }
        
        // Show browser alert as fallback
        if (document.hidden) {
          alert(`🔔 Medication Reminder: Time to take ${dose.medication_name}!`);
        }
      }, timeUntilNotification);
      
      window.medicationTimeouts.push(timeoutId);
    });

    setAllRemindersSet(true);
    toast.success(`All ${scheduledDoses.length} medication reminders have been set! You'll receive notifications at the scheduled times.`);
  };

  const scheduleAllReminders = () => {
    scheduledDoses.forEach((dose, index) => {
      const [hours, minutes] = dose.time.split(':').map(Number);
      const now = new Date();
      const reminderTime = new Date();
      reminderTime.setHours(hours, minutes, 0, 0);

      // If the time has passed today, schedule for tomorrow
      if (reminderTime <= now) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      }

      const timeUntilReminder = reminderTime.getTime() - now.getTime();

      setTimeout(() => {
        new Notification(`💊 Medication Reminder`, {
          body: `Time to take ${dose.medication_name} (${dose.dosage})${dose.food_timing ? ` - ${getFoodTimingText(dose.food_timing)}` : ''}`,
          icon: '/placeholder.svg',
          tag: `medication-${index}`,
          requireInteraction: true
        });

        // Also show a toast notification
        toast.success(`💊 Time to take ${dose.medication_name}!`, {
          description: `${dose.dosage}${dose.food_timing ? ` - ${getFoodTimingText(dose.food_timing)}` : ''}`,
          duration: 10000,
        });
      }, timeUntilReminder);
    });

    setAllRemindersSet(true);
    toast.success(`All reminders set! You'll be notified at the scheduled times.`);
  };

  const getFoodTimingText = (timing: string) => {
    switch (timing) {
      case 'before_food': return 'Before Food';
      case 'after_food': return 'After Food';
      case 'with_food': return 'With Food';
      default: return 'Anytime';
    }
  };

  const generateSchedule = () => {
    if (medications.length === 0) {
      toast.error("Please decode a prescription first");
      return;
    }

    const schedule: ScheduledDose[] = [];
    const today = new Date();
    today.setHours(parseInt(startTime.split(':')[0]), parseInt(startTime.split(':')[1]), 0, 0);

    // Use medications with side effects if available, otherwise use original medications
    const medsToUse = medicationsWithSideEffects.length > 0 ? medicationsWithSideEffects : medications;

    medsToUse.forEach(med => {
      const timesPerDay = med.times_per_day;
      const hoursApart = 24 / timesPerDay;

      for (let i = 0; i < timesPerDay; i++) {
        const doseTime = new Date(today);
        doseTime.setHours(doseTime.getHours() + (i * hoursApart));
        
        schedule.push({
          time: doseTime.toTimeString().slice(0, 5),
          medication_name: med.medication_name,
          dosage: med.dosage,
          scheduled: false,
          food_timing: med.food_timing,
          sideEffects: med.sideEffects
        });
      }
    });

    schedule.sort((a, b) => a.time.localeCompare(b.time));
    setScheduledDoses(schedule);
    setAllRemindersSet(false); // Reset reminder state when generating new schedule
    
    // Emit the schedule to parent component
    if (onScheduleGenerated) {
      onScheduleGenerated(schedule);
    }
    
    toast.success("Medication schedule generated!");
  };

  const toggleReminder = (index: number) => {
    const updated = [...scheduledDoses];
    updated[index].scheduled = !updated[index].scheduled;
    setScheduledDoses(updated);
    
    if (updated[index].scheduled) {
      toast.success(`Reminder set for ${updated[index].medication_name} at ${updated[index].time}`);
    } else {
      toast.info(`Reminder removed for ${updated[index].medication_name}`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Medication Scheduler
          </CardTitle>
          <CardDescription>
            Create a personalized schedule for your medications with automatic reminders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Unified Reminder Button */}
          {scheduledDoses.length > 0 && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-primary" />
                  <span className="font-medium">Medication Reminders</span>
                </div>
                {allRemindersSet && (
                  <Badge variant="default" className="gap-1">
                    <Check className="h-3 w-3" />
                    All Set
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-3">
                <Button
                  onClick={scheduleNotifications}
                  disabled={allRemindersSet}
                  size="sm"
                  className="gap-2"
                  variant={allRemindersSet ? "outline" : "default"}
                >
                  {allRemindersSet ? (
                    <>
                      <Check className="h-3 w-3" />
                      Reminders Active
                    </>
                  ) : (
                    <>
                      <BellRing className="h-3 w-3" />
                      Set All Reminders
                    </>
                  )}
                </Button>
                
                {allRemindersSet && (
                  <Button
                    onClick={() => {
                      setAllRemindersSet(false);
                      toast.info("Reminders cleared. Click 'Set All Reminders' to reschedule.");
                    }}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <Bell className="h-3 w-3" />
                    Clear Reminders
                  </Button>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                {notificationPermission === 'granted' 
                  ? "Browser notifications are enabled. You'll receive alerts at medication times."
                  : notificationPermission === 'denied'
                  ? "Notifications are blocked. Please enable them in your browser settings."
                  : "Click 'Set All Reminders' to enable notifications for all medications."
                }
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              />
            </div>
            
            <div className="flex-1">
              <Button 
                onClick={generateSchedule}
                disabled={medications.length === 0}
                className="gap-2 mt-6"
              >
                <Plus className="h-4 w-4" />
                Generate Schedule
              </Button>
            </div>
          </div>

          {medications.length === 0 && (
            <Alert>
              <AlertDescription>
                No medications found. Please decode a prescription first in the Decode tab.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {scheduledDoses.length > 0 && (
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-success" />
              Daily Schedule
            </CardTitle>
            <CardDescription>
              Your personalized medication schedule for today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scheduledDoses.map((dose, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold">{dose.time}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(`2000-01-01T${dose.time}`).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium">{dose.medication_name}</div>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-sm text-muted-foreground">{dose.dosage}</span>
                        {dose.food_timing && (
                          <Badge 
                            variant={
                              dose.food_timing === 'before_food' ? 'destructive' : 
                              dose.food_timing === 'after_food' ? 'default' : 
                              dose.food_timing === 'with_food' ? 'secondary' : 'outline'
                            } 
                            className="text-xs"
                          >
                            {dose.food_timing === 'before_food' ? '🍽️ Before Food' :
                             dose.food_timing === 'after_food' ? '🍽️ After Food' :
                             dose.food_timing === 'with_food' ? '🍽️ With Food' :
                             '⏰ Anytime'}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Side Effects Display */}
                      {dose.sideEffects && dose.sideEffects.length > 0 && (
                        <Collapsible className="mt-2">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 p-1 text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Side Effects ({dose.sideEffects.length})
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <div className="space-y-1">
                              {dose.sideEffects.map((sideEffect, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <Badge 
                                    variant={getSideEffectBadgeColor(sideEffect.severity)}
                                    className="text-xs"
                                  >
                                    {sideEffect.severity}
                                  </Badge>
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs"
                                  >
                                    {sideEffect.frequency}
                                  </Badge>
                                  <span className="text-muted-foreground">{sideEffect.effect}</span>
                                   {sideEffect.description && (
                                     <div className="relative group">
                                       <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                       <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                         {sideEffect.description}
                                       </div>
                                     </div>
                                   )}
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {allRemindersSet && (
                      <Badge variant="default" className="gap-1">
                        <Bell className="h-3 w-3" />
                        Reminder Active
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Alert className="mt-4">
              <AlertDescription>
                Reminders will be sent at the scheduled times. Make sure to enable notifications for this app.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
};