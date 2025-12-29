import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import { Keypair, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield, ArrowLeft, Coins, Trophy, Loader2, Check, Calendar, Clock, Settings, ToggleLeft } from "lucide-react";
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
import { createTokenWithMetaplex, CreateTokenParams, PLATFORM_WALLET, TOTAL_SUPPLY } from "@/lib/solana/createToken";
import { uploadTokenMetadata } from "@/lib/ipfsUpload";

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

interface FeatureFlag {
  id: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
}

const ICON_OPTIONS = [
  "star", "headphones", "heart", "share-2", "upload", "coins", 
  "trending-up", "bar-chart", "line-chart", "zap", "trophy", 
  "gift", "flame", "rocket", "target", "award", "twitter", "send"
];

const Admin = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
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
  const [weekInfo, setWeekInfo] = useState<{ isSunday: boolean; weekStart: Date; weekEnd: Date } | null>(null);
  
  // Feature flags state
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(false);
  
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

  // Calculate week info (Monday-Saturday engagement, Sunday snapshot)
  useEffect(() => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const isSunday = dayOfWeek === 0;
    
    // Get the Monday of the current/previous week
    const monday = new Date(now);
    if (isSunday) {
      // Go back to the previous Monday (6 days ago)
      monday.setUTCDate(now.getUTCDate() - 6);
    } else {
      // Go back to this week's Monday
      monday.setUTCDate(now.getUTCDate() - (dayOfWeek - 1));
    }
    monday.setUTCHours(0, 0, 0, 0);
    
    // Get Saturday end
    const saturday = new Date(monday);
    saturday.setUTCDate(monday.getUTCDate() + 5);
    saturday.setUTCHours(23, 59, 59, 999);
    
    setWeekInfo({ isSunday, weekStart: monday, weekEnd: saturday });
  }, []);

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
      fetchFeatureFlags();
    }
  }, [isAdmin]);

  // Fetch feature flags
  const fetchFeatureFlags = async () => {
    setLoadingFlags(true);
    try {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setFeatureFlags((data || []) as FeatureFlag[]);
    } catch (error) {
      console.error("Error fetching feature flags:", error);
    } finally {
      setLoadingFlags(false);
    }
  };

  // Toggle feature flag
  const toggleFeatureFlag = async (flag: FeatureFlag) => {
    try {
      const { error } = await supabase
        .from("feature_flags")
        .update({ is_enabled: !flag.is_enabled, updated_at: new Date().toISOString() })
        .eq("id", flag.id);

      if (error) throw error;

      setFeatureFlags(featureFlags.map(f => 
        f.id === flag.id ? { ...f, is_enabled: !f.is_enabled } : f
      ));
      toast.success(`${flag.display_name} ${!flag.is_enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error("Error toggling feature flag:", error);
      toast.error("Failed to update feature flag");
    }
  };

  // Fetch top clips for tokenization (Monday-Saturday engagement only)
  const fetchTopClips = async () => {
    if (!weekInfo) return;
    
    setLoadingClips(true);
    try {
      // Get clips created during Monday-Saturday of the week
      const { data, error } = await supabase
        .from("audio_clips")
        .select("*")
        .gte("created_at", weekInfo.weekStart.toISOString())
        .lte("created_at", weekInfo.weekEnd.toISOString())
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

  // Refetch when weekInfo changes
  useEffect(() => {
    if (isAdmin && weekInfo) {
      fetchTopClips();
    }
  }, [isAdmin, weekInfo]);

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

  // Real on-chain minting using the same method as Create page
  const handleMintSelectedClips = async () => {
    if (selectedClipIds.size === 0) {
      toast.error("Please select at least one clip to tokenize");
      return;
    }

    if (!publicKey || !connection) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!weekInfo?.isSunday) {
      toast.error("Tokens can only be minted on Sunday (snapshot day)");
      return;
    }

    setMintingClips(true);
    const selectedClips = topClips.filter(c => selectedClipIds.has(c.id));
    let successCount = 0;
    
    for (const clip of selectedClips) {
      try {
        toast.info(`Minting token for: ${clip.title}...`);
        
        // Generate symbol from title
        const symbol = clip.title.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "") || "TOKEN";
        const description = `Audio token for ${clip.title} by ${clip.creator}`;

        // Step 1: Upload metadata to IPFS
        const uploadResult = await uploadTokenMetadata(
          null, // no audio file, use URL
          null, // no image file, use URL
          { name: clip.title, symbol, description },
          clip.audio_url,
          clip.cover_image_url
        );

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "Failed to upload metadata to IPFS");
        }

        const metadataUri = uploadResult.url!;

        // Step 2: Create token on-chain
        const mintKeypair = Keypair.generate();
        const params: CreateTokenParams = {
          name: clip.title.slice(0, 32),
          symbol: symbol.slice(0, 10),
          metadataUri: metadataUri.slice(0, 200),
          totalSupply: BigInt(1_000_000_000 * 1e9),
        };

        const transaction = await createTokenWithMetaplex(
          connection,
          publicKey,
          mintKeypair,
          params
        );

        const signature = await sendTransaction(transaction, connection, {
          signers: [mintKeypair],
        });
        
        await connection.confirmTransaction(signature, "confirmed");

        const mintAddr = mintKeypair.publicKey.toString();

        // Step 3: Transfer 95% of tokens to platform wallet
        const mintPubkey = mintKeypair.publicKey;
        const creatorATA = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const platformATA = await getAssociatedTokenAddress(mintPubkey, PLATFORM_WALLET);
        
        const bondingCurveAllocation = (TOTAL_SUPPLY * BigInt(95)) / BigInt(100);
        
        const transferTx = new Transaction();
        
        const platformATAInfo = await connection.getAccountInfo(platformATA);
        if (!platformATAInfo) {
          transferTx.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              platformATA,
              PLATFORM_WALLET,
              mintPubkey
            )
          );
        }
        
        transferTx.add(
          createTransferInstruction(
            creatorATA,
            platformATA,
            publicKey,
            bondingCurveAllocation,
            [],
            TOKEN_PROGRAM_ID
          )
        );
        
        transferTx.feePayer = publicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        transferTx.recentBlockhash = blockhash;
        
        const transferSig = await sendTransaction(transferTx, connection);
        await connection.confirmTransaction(transferSig, "confirmed");

        // Step 4: Save token to database
        const initialSolReserves = 25_000_000_000;
        const initialTokenReserves = 950_000_000_000_000_000;
        
        await supabase.from("tokens").insert({
          mint_address: mintAddr,
          name: clip.title.slice(0, 32),
          symbol: symbol.slice(0, 10),
          creator_wallet: publicKey.toBase58(),
          initial_price: 1,
          total_supply: 1_000_000_000,
          metadata_uri: metadataUri,
          audio_clip_id: clip.id,
          audio_url: clip.audio_url,
          sol_reserves: initialSolReserves,
          token_reserves: initialTokenReserves,
          tokens_sold: 0,
          total_volume: 0,
          is_active: true,
        } as any);

        toast.success(`Minted: ${clip.title}`);
        successCount++;
      } catch (error: any) {
        console.error("Error minting clip:", error);
        toast.error(`Failed to mint: ${clip.title} - ${error.message}`);
      }
    }

    setMintingClips(false);
    setSelectedClipIds(new Set());
    fetchTopClips();
    
    if (successCount > 0) {
      toast.success(`Successfully minted ${successCount} tokens on-chain!`);
    }
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
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="quests">
              <Trophy className="w-4 h-4 mr-2" />
              Quests
            </TabsTrigger>
            <TabsTrigger value="tokenize">
              <Coins className="w-4 h-4 mr-2" />
              Tokenize Clips
            </TabsTrigger>
            <TabsTrigger value="features">
              <ToggleLeft className="w-4 h-4 mr-2" />
              Feature Flags
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
            {/* Week Info Card */}
            <Card className={weekInfo?.isSunday ? "border-primary bg-primary/5" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${weekInfo?.isSunday ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {weekInfo?.isSunday ? "📸 Snapshot Day - Ready to Mint!" : "Engagement Tracking Active"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Week: {weekInfo?.weekStart.toLocaleDateString()} - {weekInfo?.weekEnd.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {weekInfo?.isSunday ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                        <Check className="w-4 h-4" />
                        Sunday - Mint Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-muted text-muted-foreground text-sm rounded-full">
                        <Clock className="w-4 h-4" />
                        Mint available Sunday
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Top 5 Clips by Weekly Engagement
                </CardTitle>
                <CardDescription>
                  Clips uploaded Mon-Sat ranked by engagement. On Sunday, take a snapshot and mint the top performers as on-chain tokens.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingClips ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : topClips.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No clips uploaded this week yet, or all top clips have been minted.
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
                          disabled={!weekInfo?.isSunday}
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
                        disabled={mintingClips || selectedClipIds.size === 0 || !weekInfo?.isSunday}
                      >
                        {mintingClips ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Minting On-Chain...
                          </>
                        ) : (
                          <>
                            <Coins className="w-4 h-4 mr-2" />
                            Mint On-Chain ({selectedClipIds.size})
                          </>
                        )}
                      </Button>
                    </div>
                    {!weekInfo?.isSunday && (
                      <p className="text-sm text-center text-muted-foreground pt-2">
                        ⏰ Minting is only available on Sunday (snapshot day)
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feature Flags Tab */}
          <TabsContent value="features" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Feature Flags
                </CardTitle>
                <CardDescription>
                  Enable or disable features across the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFlags ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {featureFlags.map((flag) => (
                      <div
                        key={flag.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      >
                        <div className="space-y-1">
                          <div className="font-medium">{flag.display_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {flag.description || flag.feature_key}
                          </div>
                        </div>
                        <Switch
                          checked={flag.is_enabled}
                          onCheckedChange={() => toggleFeatureFlag(flag)}
                        />
                      </div>
                    ))}
                    {featureFlags.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No feature flags configured
                      </p>
                    )}
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