import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
import { Play, Pause, Heart, Share2, Coins, Plus, Upload, Loader2 } from "lucide-react";

interface AudioClip {
  id: string;
  title: string;
  creator: string;
  audioUrl: string;
  category: string;
  likes: number;
  shares: number;
  plays: number;
  createdAt: number;
  hasLiked?: boolean;
}

const CATEGORIES = ["All", "Memes", "Music", "Voice", "Sound Effects", "AI Generated", "Other"];

const DEMO_CLIPS: AudioClip[] = [
  {
    id: "1",
    title: "Bruh Sound Effect #2",
    creator: "7Np...abc",
    audioUrl: "",
    category: "Memes",
    likes: 42,
    shares: 15,
    plays: 230,
    createdAt: Date.now() - 86400000,
  },
  {
    id: "2",
    title: "Vine Boom Bass",
    creator: "8Kp...def",
    audioUrl: "",
    category: "Memes",
    likes: 128,
    shares: 45,
    plays: 892,
    createdAt: Date.now() - 172800000,
  },
  {
    id: "3",
    title: "AI Trump Voice",
    creator: "2Lp...ghi",
    audioUrl: "",
    category: "AI Generated",
    likes: 67,
    shares: 23,
    plays: 456,
    createdAt: Date.now() - 259200000,
  },
  {
    id: "4",
    title: "Dramatic Chipmunk",
    creator: "4Mp...jkl",
    audioUrl: "",
    category: "Sound Effects",
    likes: 89,
    shares: 34,
    plays: 567,
    createdAt: Date.now() - 345600000,
  },
];

const DiscoverPage = () => {
  const navigate = useNavigate();
  const [clips, setClips] = useState<AudioClip[]>(DEMO_CLIPS);
  const [filteredClips, setFilteredClips] = useState<AudioClip[]>(DEMO_CLIPS);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Memes");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    filterClips();
  }, [selectedCategory, clips]);

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

    setTimeout(() => {
      const newClip: AudioClip = {
        id: Date.now().toString(),
        title: uploadTitle,
        creator: "You...abc",
        audioUrl: URL.createObjectURL(uploadFile),
        category: uploadCategory,
        likes: 0,
        shares: 0,
        plays: 0,
        createdAt: Date.now(),
      };

      setClips([newClip, ...clips]);
      toast.success("Audio clip uploaded successfully!");
      setShowUploadModal(false);
      setUploadTitle("");
      setUploadFile(null);
      setLoading(false);
    }, 1500);
  };

  const handleLike = (clipId: string) => {
    setClips(
      clips.map((clip) => {
        if (clip.id === clipId) {
          return {
            ...clip,
            likes: clip.hasLiked ? clip.likes - 1 : clip.likes + 1,
            hasLiked: !clip.hasLiked,
          };
        }
        return clip;
      })
    );
  };

  const handleShare = (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (clip) {
      navigator.clipboard.writeText(`${window.location.origin}/discover?clip=${clipId}`);
      toast.success("Link copied to clipboard!");
      setClips(clips.map((c) => (c.id === clipId ? { ...c, shares: c.shares + 1 } : c)));
    }
  };

  const handlePlay = (clipId: string) => {
    setPlayingClip(playingClip === clipId ? null : clipId);
    setClips(clips.map((c) => (c.id === clipId ? { ...c, plays: c.plays + 1 } : c)));
  };

  const handleMintClick = (clip: AudioClip) => {
    localStorage.setItem(
      "noizlabs_mint_audio",
      JSON.stringify({
        title: clip.title,
        audioUrl: clip.audioUrl,
        category: clip.category,
      })
    );
    navigate("/create");
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
          {filteredClips.length === 0 ? (
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