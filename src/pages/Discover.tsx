import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TopClipsSection from "@/components/TopClipsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Pause, Heart, Share2, Coins, Plus, Upload, Loader2, Trophy } from "lucide-react";

interface AudioClip {
  id: string;
  title: string;
  creator: string;
  audioUrl: string;
  category: string;
  likes: number;
  shares: number;
  plays: number;
  createdAt: string;
  hasLiked?: boolean;
}

const CATEGORIES = ["All", "Memes", "Music", "Voice", "Sound Effects", "AI Generated", "Other"];

const DiscoverPage = () => {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [filteredClips, setFilteredClips] = useState<AudioClip[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingClips, setLoadingClips] = useState(true);

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Memes");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    fetchClips();

    // Subscribe to real-time updates for audio_clips
    const channel = supabase
      .channel('discover-clips-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audio_clips'
        },
        (payload) => {
          console.log('Real-time clip update:', payload);
          
          if (payload.eventType === 'INSERT') {
            // Add new clip to the beginning
            const newClip = payload.new as any;
            const mappedClip: AudioClip = {
              id: newClip.id,
              title: newClip.title,
              creator: newClip.creator,
              audioUrl: newClip.audio_url,
              category: newClip.category || "Other",
              likes: newClip.likes || 0,
              shares: newClip.shares || 0,
              plays: newClip.plays || 0,
              createdAt: newClip.created_at,
              hasLiked: false,
            };
            setClips(prev => [mappedClip, ...prev.filter(c => c.id !== newClip.id)]);
          } else if (payload.eventType === 'UPDATE') {
            // Update existing clip
            const updated = payload.new as any;
            setClips(prev => prev.map(clip => 
              clip.id === updated.id 
                ? { 
                    ...clip, 
                    likes: updated.likes || 0, 
                    shares: updated.shares || 0, 
                    plays: updated.plays || 0 
                  }
                : clip
            ));
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted clip
            const deleted = payload.old as any;
            setClips(prev => prev.filter(clip => clip.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterClips();
  }, [selectedCategory, clips]);

  const fetchClips = async () => {
    try {
      const { data, error } = await supabase
        .from("audio_clips")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedClips: AudioClip[] = (data || []).map((clip) => ({
        id: clip.id,
        title: clip.title,
        creator: clip.creator,
        audioUrl: clip.audio_url,
        category: clip.category || "Other",
        likes: clip.likes || 0,
        shares: clip.shares || 0,
        plays: clip.plays || 0,
        createdAt: clip.created_at,
        hasLiked: false,
      }));

      setClips(mappedClips);
    } catch (error) {
      console.error("Error fetching clips:", error);
      toast.error("Failed to load clips");
    } finally {
      setLoadingClips(false);
    }
  };

  const filterClips = () => {
    if (selectedCategory === "All") {
      setFilteredClips(clips);
    } else {
      setFilteredClips(clips.filter((clip) => clip.category === selectedCategory));
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle) {
      toast.error("Please fill all fields!");
      return;
    }

    setLoading(true);

    try {
      const walletAddress = publicKey?.toString() || null;
      const creatorName = walletAddress 
        ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-3)}`
        : "Anonymous";

      // Upload to IPFS via edge function
      toast.info("Uploading to IPFS...");
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('fileName', `${uploadTitle.replace(/[^a-zA-Z0-9]/g, '_')}.${uploadFile.name.split('.').pop()}`);

      const { data: funcData, error: funcError } = await supabase.functions.invoke('upload-to-ipfs', {
        body: formData,
      });

      if (funcError || !funcData?.success) {
        throw new Error(funcData?.error || funcError?.message || 'Failed to upload to IPFS');
      }

      const audioUrl = funcData.url;
      toast.success("Uploaded to IPFS!");

      const { data, error } = await supabase.from("audio_clips").insert({
        title: uploadTitle,
        creator: creatorName,
        audio_url: audioUrl,
        category: uploadCategory,
        wallet_address: walletAddress,
        likes: 0,
        shares: 0,
        plays: 0,
      }).select().single();

      if (error) throw error;

      const newClip: AudioClip = {
        id: data.id,
        title: uploadTitle,
        creator: creatorName,
        audioUrl: audioUrl,
        category: uploadCategory,
        likes: 0,
        shares: 0,
        plays: 0,
        createdAt: data.created_at,
      };

      setClips([newClip, ...clips]);
      toast.success("Audio clip uploaded successfully!");
      setShowUploadModal(false);
      setUploadTitle("");
      setUploadFile(null);

      // Update task progress for uploading
      if (walletAddress) {
        await updateTaskProgress(walletAddress, "upload_clips", 1);
      }
    } catch (error) {
      console.error("Error uploading clip:", error);
      toast.error("Failed to upload clip");
    } finally {
      setLoading(false);
    }
  };

  const updateTaskProgress = async (walletAddress: string, taskType: string, increment: number) => {
    try {
      const { data: task } = await supabase
        .from("user_tasks")
        .select("*")
        .eq("wallet_address", walletAddress)
        .eq("task_type", taskType)
        .maybeSingle();

      if (task) {
        const newProgress = (task.progress || 0) + increment;
        const completed = newProgress >= task.target;

        await supabase
          .from("user_tasks")
          .update({ progress: newProgress, completed })
          .eq("id", task.id);
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleLike = async (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    const newLikes = clip.hasLiked ? clip.likes - 1 : clip.likes + 1;

    // Update local state
    setClips(
      clips.map((c) => {
        if (c.id === clipId) {
          return {
            ...c,
            likes: newLikes,
            hasLiked: !c.hasLiked,
          };
        }
        return c;
      })
    );

    // Update database
    try {
      await supabase
        .from("audio_clips")
        .update({ likes: newLikes })
        .eq("id", clipId);

      // Track interaction
      if (publicKey && !clip.hasLiked) {
        await supabase.from("user_interactions").insert({
          wallet_address: publicKey.toString(),
          audio_clip_id: clipId,
          interaction_type: "like",
        });
        await updateTaskProgress(publicKey.toString(), "interact_clips", 1);
      }
    } catch (error) {
      console.error("Error updating like:", error);
    }
  };

  const handleShare = async (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (clip) {
      navigator.clipboard.writeText(`${window.location.origin}/discover?clip=${clipId}`);
      toast.success("Link copied to clipboard!");

      const newShares = clip.shares + 1;
      setClips(clips.map((c) => (c.id === clipId ? { ...c, shares: newShares } : c)));

      try {
        await supabase
          .from("audio_clips")
          .update({ shares: newShares })
          .eq("id", clipId);

        if (publicKey) {
          await supabase.from("user_interactions").insert({
            wallet_address: publicKey.toString(),
            audio_clip_id: clipId,
            interaction_type: "share",
          });
          await updateTaskProgress(publicKey.toString(), "interact_clips", 1);
        }
      } catch (error) {
        console.error("Error updating share:", error);
      }
    }
  };

  const handlePlay = async (clipId: string) => {
    const wasPlaying = playingClip === clipId;
    setPlayingClip(wasPlaying ? null : clipId);

    if (!wasPlaying) {
      const clip = clips.find((c) => c.id === clipId);
      if (clip) {
        const newPlays = clip.plays + 1;
        setClips(clips.map((c) => (c.id === clipId ? { ...c, plays: newPlays } : c)));

        try {
          await supabase
            .from("audio_clips")
            .update({ plays: newPlays })
            .eq("id", clipId);

          if (publicKey) {
            await supabase.from("user_interactions").insert({
              wallet_address: publicKey.toString(),
              audio_clip_id: clipId,
              interaction_type: "play",
            });
            await updateTaskProgress(publicKey.toString(), "interact_clips", 1);
          }
        } catch (error) {
          console.error("Error updating play:", error);
        }
      }
    }
  };

  const handleMintClick = (clip: AudioClip) => {
    localStorage.setItem(
      "noizlabs_mint_audio",
      JSON.stringify({
        id: clip.id,
        title: clip.title,
        audioUrl: clip.audioUrl,
        category: clip.category,
      })
    );
    navigate("/create");
    toast.success("Audio loaded! Complete the form to mint your token.");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20 min-h-screen">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                🎧 Discover Audio Clips
              </h1>
              <p className="text-muted-foreground mt-2">
                Upload, listen, and mint audio as tokens
              </p>
            </div>

            <Button onClick={() => setShowUploadModal(true)}>
              <Plus className="w-5 h-5 mr-2" />
              Upload Audio
            </Button>
          </div>

          {/* Top Section: Top Clips + Leaderboard Link */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <TopClipsSection />
            </div>
            <div className="bg-card rounded-xl border border-border p-6 flex flex-col items-center justify-center text-center">
              <Trophy className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Earn Points & Rewards</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Complete tasks to earn points and climb the leaderboard!
              </p>
              <Link to="/leaderboard">
                <Button>
                  <Trophy className="w-4 h-4 mr-2" />
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-4 mb-8">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                variant={selectedCategory === cat ? "default" : "outline"}
              >
                {cat}
              </Button>
            ))}
          </div>

          {/* Audio Feed */}
          {loadingClips ? (
            <div className="text-center py-20">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading clips...</p>
            </div>
          ) : filteredClips.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-border">
              <p className="text-muted-foreground text-xl mb-4">
                No audio clips yet in this category!
              </p>
              <Button onClick={() => setShowUploadModal(true)}>
                Upload First Clip
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClips.map((clip) => (
                <div
                  key={clip.id}
                  className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-colors"
                >
                  {/* Header */}
                  <div className="bg-primary p-4 text-primary-foreground">
                    <h3 className="font-bold text-lg mb-1">{clip.title}</h3>
                    <p className="text-sm text-primary-foreground/80">by {clip.creator}</p>
                    <span className="inline-block mt-2 px-2 py-1 bg-background/20 rounded-full text-xs">
                      {clip.category}
                    </span>
                  </div>

                  {/* Audio Player */}
                  <div className="p-4 bg-muted">
                    <Button
                      onClick={() => handlePlay(clip.id)}
                      variant={playingClip === clip.id ? "secondary" : "default"}
                      className="w-full"
                    >
                      {playingClip === clip.id ? (
                        <>
                          <Pause className="w-5 h-5 mr-2" />
                          Playing...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          Play Audio
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Stats */}
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex justify-around text-sm text-muted-foreground">
                      <div className="text-center">
                        <p className="font-bold text-foreground">{clip.plays}</p>
                        <p className="text-xs">Plays</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-foreground">{clip.likes}</p>
                        <p className="text-xs">Likes</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-foreground">{clip.shares}</p>
                        <p className="text-xs">Shares</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 space-y-2">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleLike(clip.id)}
                        variant={clip.hasLiked ? "destructive" : "outline"}
                        className="flex-1"
                      >
                        <Heart
                          className={`w-4 h-4 mr-1 ${clip.hasLiked ? "fill-current" : ""}`}
                        />
                        Like
                      </Button>
                      <Button
                        onClick={() => handleShare(clip.id)}
                        variant="outline"
                        className="flex-1"
                      >
                        <Share2 className="w-4 h-4 mr-1" />
                        Share
                      </Button>
                    </div>

                    <Button
                      onClick={() => handleMintClick(clip)}
                      className="w-full"
                    >
                      <Coins className="w-4 h-4 mr-2" />
                      Mint as Token
                    </Button>
                  </div>

                  {/* Timestamp */}
                  <div className="px-4 pb-3 text-xs text-muted-foreground">
                    {new Date(clip.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Upload Audio Clip
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>Title</Label>
              <Input
                type="text"
                placeholder="My Awesome Audio"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Audio File</Label>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="mt-2"
              />
            </div>

            {uploadFile && (
              <div className="bg-muted p-4 rounded-lg">
                <audio controls className="w-full">
                  <source src={URL.createObjectURL(uploadFile)} type={uploadFile.type} />
                </audio>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={loading || !uploadTitle || !uploadFile}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Clip
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiscoverPage;
