import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Play, Heart, Trophy, Coins, Crown } from "lucide-react";
import { toast } from "sonner";

interface AudioClip {
  id: string;
  title: string;
  creator: string;
  audio_url: string;
  category: string;
  likes: number;
  shares: number;
  plays: number;
  wallet_address: string | null;
  created_at: string;
}

const TopClipsSection = () => {
  const navigate = useNavigate();
  const [topClips, setTopClips] = useState<AudioClip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopClips();
  }, []);

  const fetchTopClips = async () => {
    try {
      const { data, error } = await supabase
        .from("audio_clips")
        .select("*")
        .order("likes", { ascending: false })
        .order("plays", { ascending: false })
        .limit(5);

      if (error) throw error;
      setTopClips(data || []);
    } catch (error) {
      console.error("Error fetching top clips:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMintClick = (clip: AudioClip) => {
    localStorage.setItem(
      "noizlabs_mint_audio",
      JSON.stringify({
        id: clip.id,
        title: clip.title,
        audioUrl: clip.audio_url,
        category: clip.category,
      })
    );
    navigate("/create");
    toast.success("Audio loaded! Complete the form to mint your token.");
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Trophy className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">#{index + 1}</span>;
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (topClips.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No clips yet. Be the first to upload!</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-accent p-4 text-primary-foreground">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6" />
          <div>
            <h3 className="font-bold text-lg">Top 5 Clips Get Tokenized!</h3>
            <p className="text-sm text-primary-foreground/80">Most engaged clips this week</p>
          </div>
        </div>
      </div>

      {/* Top Clips List */}
      <div className="divide-y divide-border">
        {topClips.map((clip, index) => (
          <div
            key={clip.id}
            className={`p-4 flex items-center gap-4 transition-colors hover:bg-muted/50 ${
              index === 0 ? "bg-yellow-500/5" : ""
            }`}
          >
            {/* Rank */}
            <div className="w-8 flex-shrink-0">{getRankIcon(index)}</div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{clip.title}</p>
              <p className="text-xs text-muted-foreground">by {clip.creator}</p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Play className="w-4 h-4" />
                <span>{clip.plays}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="w-4 h-4" />
                <span>{clip.likes}</span>
              </div>
            </div>

            {/* Mint Button */}
            <Button size="sm" onClick={() => handleMintClick(clip)}>
              <Coins className="w-4 h-4 mr-1" />
              Mint
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopClipsSection;
