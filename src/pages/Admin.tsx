import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface QuestDefinition {
  id: string;
  task_type: string;
  display_name: string;
  description: string | null;
  target: number;
  points_reward: number;
  reset_period: string;
  icon: string;
  is_active: boolean;
  social_link: string | null;
}

const ICON_OPTIONS = [
  "star", "headphones", "heart", "share-2", "upload", "coins", 
  "trending-up", "bar-chart", "line-chart", "zap", "trophy", 
  "gift", "flame", "rocket", "target", "award", "twitter", "send"
];

const Admin = () => {
  const { publicKey } = useWallet();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quests, setQuests] = useState<QuestDefinition[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState<QuestDefinition | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    task_type: "",
    display_name: "",
    description: "",
    target: 1,
    points_reward: 10,
    reset_period: "daily",
    icon: "star",
    is_active: true,
    social_link: "",
  });

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!publicKey) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("admin_wallets")
        .select("id")
        .eq("wallet_address", publicKey.toBase58())
        .maybeSingle();

      setIsAdmin(!!data);
      setLoading(false);
    };

    checkAdmin();
  }, [publicKey]);

  // Fetch quests
  useEffect(() => {
    const fetchQuests = async () => {
      const { data } = await supabase
        .from("quest_definitions")
        .select("*")
        .order("created_at", { ascending: true });
      
      if (data) {
        setQuests(data as QuestDefinition[]);
      }
    };

    if (isAdmin) {
      fetchQuests();
    }
  }, [isAdmin]);

  const resetForm = () => {
    setFormData({
      task_type: "",
      display_name: "",
      description: "",
      target: 1,
      points_reward: 10,
      reset_period: "daily",
      icon: "star",
      is_active: true,
      social_link: "",
    });
    setEditingQuest(null);
  };

  const openEditDialog = (quest: QuestDefinition) => {
    setEditingQuest(quest);
    setFormData({
      task_type: quest.task_type,
      display_name: quest.display_name,
      description: quest.description || "",
      target: quest.target,
      points_reward: quest.points_reward,
      reset_period: quest.reset_period,
      icon: quest.icon,
      is_active: quest.is_active,
      social_link: quest.social_link || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!publicKey) return;

    try {
      const response = await supabase.functions.invoke("manage-quests", {
        body: {
          action: editingQuest ? "update" : "create",
          wallet_address: publicKey.toBase58(),
          quest_id: editingQuest?.id,
          quest_data: formData,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success(editingQuest ? "Quest updated!" : "Quest created!");
      
      // Refresh quests
      const { data } = await supabase
        .from("quest_definitions")
        .select("*")
        .order("created_at", { ascending: true });
      
      if (data) {
        setQuests(data as QuestDefinition[]);
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving quest:", error);
      toast.error("Failed to save quest");
    }
  };

  const handleDelete = async (questId: string) => {
    if (!publicKey) return;
    
    if (!confirm("Are you sure you want to delete this quest?")) return;

    try {
      const response = await supabase.functions.invoke("manage-quests", {
        body: {
          action: "delete",
          wallet_address: publicKey.toBase58(),
          quest_id: questId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Quest deleted!");
      setQuests(quests.filter(q => q.id !== questId));
    } catch (error) {
      console.error("Error deleting quest:", error);
      toast.error("Failed to delete quest");
    }
  };

  const handleToggleActive = async (quest: QuestDefinition) => {
    if (!publicKey) return;

    try {
      const response = await supabase.functions.invoke("manage-quests", {
        body: {
          action: "update",
          wallet_address: publicKey.toBase58(),
          quest_id: quest.id,
          quest_data: { is_active: !quest.is_active },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setQuests(quests.map(q => 
        q.id === quest.id ? { ...q, is_active: !q.is_active } : q
      ));
      toast.success(`Quest ${!quest.is_active ? "activated" : "deactivated"}`);
    } catch (error) {
      console.error("Error toggling quest:", error);
      toast.error("Failed to update quest");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Connect Wallet</h2>
            <p className="text-muted-foreground">Please connect your wallet to access the admin panel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">Your wallet is not authorized to access this page.</p>
            <Button onClick={() => navigate("/")} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Quest Admin Panel</h1>
              <p className="text-muted-foreground">Manage daily quests and rewards</p>
            </div>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Quest
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingQuest ? "Edit Quest" : "Create New Quest"}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="task_type">Task Type (unique identifier)</Label>
                  <Input
                    id="task_type"
                    value={formData.task_type}
                    onChange={(e) => setFormData({ ...formData, task_type: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                    placeholder="e.g., listen_clips"
                    disabled={!!editingQuest}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="e.g., Listen to Clips"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g., Play audio clips to earn points"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="target">Target</Label>
                    <Input
                      id="target"
                      type="number"
                      min={1}
                      value={formData.target}
                      onChange={(e) => setFormData({ ...formData, target: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="points_reward">Points Reward</Label>
                    <Input
                      id="points_reward"
                      type="number"
                      min={1}
                      value={formData.points_reward}
                      onChange={(e) => setFormData({ ...formData, points_reward: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Reset Period</Label>
                    <Select
                      value={formData.reset_period}
                      onValueChange={(value) => setFormData({ ...formData, reset_period: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Icon</Label>
                    <Select
                      value={formData.icon}
                      onValueChange={(value) => setFormData({ ...formData, icon: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map(icon => (
                          <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Active</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="social_link">Social Link (optional)</Label>
                  <Input
                    id="social_link"
                    value={formData.social_link}
                    onChange={(e) => setFormData({ ...formData, social_link: e.target.value })}
                    placeholder="e.g., https://x.com/noizlabs"
                  />
                  <p className="text-xs text-muted-foreground">
                    For social quests: users click to visit this link and complete the quest
                  </p>
                </div>
                
                <Button onClick={handleSubmit} className="w-full">
                  {editingQuest ? "Update Quest" : "Create Quest"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quest Definitions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Active</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Social Link</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quests.map((quest) => (
                  <TableRow key={quest.id}>
                    <TableCell>
                      <Switch
                        checked={quest.is_active}
                        onCheckedChange={() => handleToggleActive(quest)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{quest.display_name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">{quest.task_type}</TableCell>
                    <TableCell>{quest.target}</TableCell>
                    <TableCell>{quest.points_reward} pts</TableCell>
                    <TableCell>
                      {quest.social_link ? (
                        <a href={quest.social_link} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm truncate max-w-[150px] block">
                          {quest.social_link.replace(/^https?:\/\//, '').slice(0, 25)}...
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(quest)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(quest.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;