import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield, ArrowLeft, Coins, Trophy, Loader2, Check } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

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

interface TopClip {
  id: string;
  title: string;
  creator: string;
  audio_url: string;
  cover_image_url: string | null;
  category: string;
  likes: number;
  plays: number;
  shares: number;
  total_engagement: number;
  selected?: boolean;
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
  
  // Top clips state
  const [topClips, setTopClips] = useState<TopClip[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [mintingClips, setMintingClips] = useState(false);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  
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
      fetchTopClips();
    }
  }, [isAdmin]);

  // Fetch top clips for tokenization
  const fetchTopClips = async () => {
    setLoadingClips(true);
    try {
      const { data, error } = await supabase
        .from("audio_clips")
        .select("*")
        .order("likes", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Calculate total engagement and filter out already tokenized clips
      const { data: existingTokens } = await supabase
        .from("tokens")
        .select("audio_clip_id");

      const tokenizedIds = new Set((existingTokens || []).map(t => t.audio_clip_id));

      const clipsWithEngagement = (data || [])
        .filter(clip => !tokenizedIds.has(clip.id))
        .map(clip => ({
          ...clip,
          total_engagement: (clip.likes || 0) + (clip.plays || 0) + (clip.shares || 0),
        }))
        .sort((a, b) => b.total_engagement - a.total_engagement)
        .slice(0, 5);

      setTopClips(clipsWithEngagement);
    } catch (error) {
      console.error("Error fetching top clips:", error);
    } finally {
      setLoadingClips(false);
    }
  };

  const toggleClipSelection = (clipId: string) => {
    setSelectedClipIds(prev => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const handleMintSelectedClips = async () => {
    if (selectedClipIds.size === 0) {
      toast.error("Please select at least one clip to tokenize");
      return;
    }

    setMintingClips(true);
    const selectedClips = topClips.filter(c => selectedClipIds.has(c.id));
    
    for (const clip of selectedClips) {
      try {
        // Generate a simple mint address for demo (in production, this would be a real token)
        const fakeMintAddress = `MINT${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const symbol = clip.title.slice(0, 5).toUpperCase().replace(/[^A-Z]/g, "") || "TOKEN";

        // Create token record
        const { error } = await supabase.from("tokens").insert({
          name: clip.title,
          symbol,
          mint_address: fakeMintAddress,
          creator_wallet: publicKey?.toBase58() || "",
          total_supply: 1000000000000000,
          initial_price: 1000,
          audio_url: clip.audio_url,
          audio_clip_id: clip.id,
          sol_reserves: 10000000,
          token_reserves: 100000000000000000,
          is_active: true,
        });

        if (error) throw error;
        toast.success(`Tokenized: ${clip.title}`);
      } catch (error) {
        console.error("Error tokenizing clip:", error);
        toast.error(`Failed to tokenize: ${clip.title}`);
      }
    }

    setMintingClips(false);
    setSelectedClipIds(new Set());
    fetchTopClips(); // Refresh list
    toast.success(`Successfully tokenized ${selectedClips.length} clips!`);
  };

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

      // Check if the response data contains an error
      if (response.data?.error) {
        throw new Error(response.data.error);
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
    } catch (error: unknown) {
      console.error("Error saving quest:", error);
      const message = error instanceof Error ? error.message : "Failed to save quest";
      if (message.includes("duplicate key") || message.includes("already exists")) {
        toast.error("A quest with this task type already exists. Use a unique task type.");
      } else {
        toast.error(message);
      }
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
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">Manage quests and tokenize top clips</p>
          </div>
        </div>

        <Tabs defaultValue="quests" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="quests">
              <Trophy className="w-4 h-4 mr-2" />
              Quests
            </TabsTrigger>
            <TabsTrigger value="tokenize">
              <Coins className="w-4 h-4 mr-2" />
              Tokenize Clips
            </TabsTrigger>
          </TabsList>

          {/* Quests Tab */}
          <TabsContent value="quests" className="space-y-6">
            <div className="flex justify-end">
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
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="one_time">One Time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Icon</Label>
                        <Select
                          value={formData.icon}
                          onValueChange={(value) => setFormData({ ...formData, icon: value })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <TableHead>Reset</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Reward</TableHead>
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
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${
                            quest.reset_period === 'one_time' 
                              ? 'bg-primary/20 text-primary' 
                              : quest.reset_period === 'weekly'
                                ? 'bg-secondary/50 text-secondary-foreground'
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            {quest.reset_period === 'one_time' ? 'One Time' : quest.reset_period}
                          </span>
                        </TableCell>
                        <TableCell>{quest.target}</TableCell>
                        <TableCell>{quest.points_reward} pts</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(quest)}>
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
          </TabsContent>

          {/* Tokenize Clips Tab */}
          <TabsContent value="tokenize" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Top 5 Clips by Engagement
                </CardTitle>
                <CardDescription>
                  Select clips to tokenize. These are the most popular clips that haven't been minted yet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingClips ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : topClips.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No clips available to tokenize. All top clips have been minted.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {topClips.map((clip, index) => (
                      <div
                        key={clip.id}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                          selectedClipIds.has(clip.id) ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <Checkbox
                          checked={selectedClipIds.has(clip.id)}
                          onCheckedChange={() => toggleClipSelection(clip.id)}
                        />
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                          {index + 1}
                        </div>
                        {clip.cover_image_url && (
                          <img
                            src={clip.cover_image_url}
                            alt={clip.title}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{clip.title}</p>
                          <p className="text-sm text-muted-foreground">by {clip.creator}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">
                            ❤️ {clip.likes} · ▶️ {clip.plays} · 🔗 {clip.shares}
                          </p>
                          <p className="font-semibold text-primary">{clip.total_engagement} total</p>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        {selectedClipIds.size} clip(s) selected
                      </p>
                      <Button
                        onClick={handleMintSelectedClips}
                        disabled={mintingClips || selectedClipIds.size === 0}
                      >
                        {mintingClips ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Minting...
                          </>
                        ) : (
                          <>
                            <Coins className="w-4 h-4 mr-2" />
                            Mint Selected ({selectedClipIds.size})
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;