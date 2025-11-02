import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Plus, Mail, Phone, Shield, UserCheck, Share2, Bell, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useSupabase } from "@/hooks/useSupabase";

interface CareCircleMember {
  id: string;
  member_name: string;
  member_email: string;
  role: "family" | "caregiver" | "doctor" | "pharmacist";
  status: "invited" | "active" | "pending" | "declined";
  permissions: string[];
  invited_at: string;
  joined_at: string | null;
}

export const CareCircle = () => {
  const { user } = useUser();
  const { db } = useSupabase();
  const [members, setMembers] = useState<CareCircleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<CareCircleMember["role"]>("family");

  // Load care circle members on component mount
  useEffect(() => {
    if (user?.id) {
      loadMembers();
    }
  }, [user?.id]);

  const loadMembers = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const data = await db.getCareCircleMembers(user.id);
      setMembers(data || []);
    } catch (error) {
      console.error('Failed to load care circle members:', error);
      toast.error('Failed to load care circle members');
    } finally {
      setLoading(false);
    }
  };

  // Get default permissions based on role
  const getDefaultPermissions = (role: CareCircleMember["role"]): string[] => {
    switch (role) {
      case 'doctor':
        return ['view_schedule', 'view_adherence', 'manage_medications'];
      case 'pharmacist':
        return ['view_schedule', 'view_adherence'];
      case 'caregiver':
        return ['view_schedule', 'view_adherence', 'receive_alerts'];
      case 'family':
        return ['view_schedule', 'receive_alerts'];
      default:
        return ['view_schedule'];
    }
  };

  const addMember = async () => {
    if (!newMemberEmail.trim()) {
      toast.error("Please enter an email address or user ID");
      return;
    }

    if (!user?.id) {
      toast.error("You must be logged in to add members");
      return;
    }

    try {
      setAddingMember(true);
      
      // Determine if input is email or user ID
      const isEmail = newMemberEmail.includes('@');
      const isUserId = newMemberEmail.startsWith('user_') || newMemberEmail.startsWith('clerk_');
      
      let memberName = '';
      let memberEmail = '';
      
      if (isEmail) {
        memberEmail = newMemberEmail.trim();
        memberName = newMemberEmail.split('@')[0]; // Use email prefix as default name
      } else if (isUserId) {
        memberEmail = ''; // Will be filled when user accepts invitation
        memberName = `User ${newMemberEmail.substring(0, 12)}...`; // Truncated user ID as name
      } else {
        // Treat as email if it doesn't match user ID pattern
        memberEmail = newMemberEmail.trim();
        memberName = newMemberEmail.split('@')[0] || 'Unknown User';
      }
      
      const memberData = {
        patient_id: user.id,
        member_email: memberEmail,
        member_name: memberName,
        member_user_id: isUserId ? newMemberEmail.trim() : null, // Store user ID if provided
        role: newMemberRole,
        status: "invited" as const,
        permissions: getDefaultPermissions(newMemberRole)
      };

      await db.addCareCircleMember(memberData);
      setNewMemberEmail("");
      await loadMembers(); // Reload the list
      toast.success(`Invitation sent to ${newMemberEmail}`);
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error('Failed to send invitation');
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (id: string) => {
    try {
      await db.removeCareCircleMember(id);
      await loadMembers(); // Reload the list
      toast.success("Member removed from care circle");
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "doctor":
        return "👩‍⚕️";
      case "family":
        return "👨‍👩‍👧‍👦";
      case "caregiver":
        return "🤝";
      case "pharmacist":
        return "💊";
      default:
        return "👤";
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "doctor":
        return "default";
      case "family":
        return "secondary";
      case "caregiver":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
      case "pending":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      case "invited":
        return <Badge variant="outline">Invited</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Add New Member */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Care Circle Member
          </CardTitle>
          <CardDescription>
            Invite family members, caregivers, or healthcare providers to support your medication journey
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Email Address or User ID</label>
              <Input
                type="text"
                placeholder="Enter email address or user ID (e.g., user_2abc123def)"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                You can invite by email or by their unique user ID
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Role</label>
              <select 
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as CareCircleMember["role"])}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="family">Family Member</option>
                <option value="caregiver">Caregiver</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacist">Pharmacist</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={addMember} 
                className="gap-2" 
                disabled={addingMember || !newMemberEmail.trim()}
              >
                {addingMember ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {addingMember ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Invitations require your explicit consent and members can only access information you've shared.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Current Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Care Circle Members ({members.length})
          </CardTitle>
          <CardDescription>
            People who can help support your medication adherence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading care circle members...</p>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No care circle members yet</p>
                <p className="text-sm">Add family members or caregivers to get started</p>
              </div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="" />
                      <AvatarFallback>
                        {getRoleIcon(member.role)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <div className="font-medium">{member.member_name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {member.member_email}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                        {getStatusBadge(member.status)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {member.status === "active" && (
                      <Button variant="outline" size="sm" className="gap-2">
                        <Share2 className="h-3 w-3" />
                        Share Status
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => removeMember(member.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sharing & Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Sharing & Privacy
          </CardTitle>
          <CardDescription>
            Control what information your care circle can access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Medication Schedule</div>
                <div className="text-sm text-muted-foreground">
                  Share your daily medication schedule with care circle
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <UserCheck className="h-3 w-3" />
                Shared
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Adherence Reports</div>
                <div className="text-sm text-muted-foreground">
                  Allow access to medication adherence tracking
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <UserCheck className="h-3 w-3" />
                Shared
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Missed Dose Alerts</div>
                <div className="text-sm text-muted-foreground">
                  Notify care circle when doses are missed
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Bell className="h-3 w-3" />
                Enabled
              </Button>
            </div>
          </div>

          <Alert className="mt-4">
            <Shield className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>All shared data is encrypted and HIPAA compliant. You can revoke access at any time.</span>
              <Link to="/caretaker">
                <Button variant="outline" size="sm" className="gap-2 ml-4">
                  <ExternalLink className="h-3 w-3" />
                  View Caretaker Dashboard
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};