import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Pause, Heart, Share2, Coins, Plus, Upload, Loader2, MoreHorizontal, ArrowRightLeft, Sparkles, X } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import { updateTaskProgress, ensureUserTasks } from "@/lib/taskUtils";

interface AudioClip {
  id: string;
  title: string;
  creator: string;
  audioUrl: string;
  coverImageUrl: string | null;
  category: string;
  likes: number;
  shares: number;
  plays: number;
  createdAt: string;
  hasLiked?: boolean;
  mintedTokenId?: string | null;
  mintAddress?: string | null;
}

const CATEGORIES = ["All", "Memes", "Music", "Voice", "Sound Effects", "AI Generated", "Other"];

interface ClipsTabProps {
  showUploadModal: boolean;
  setShowUploadModal: (show: boolean) => void;
}

const ClipsTab = ({ showUploadModal, setShowUploadModal }: ClipsTabProps) => {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [filteredClips, setFilteredClips] = useState<AudioClip[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingClips, setLoadingClips] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const uploadCoverInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAudioInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Memes");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCoverImage, setUploadCoverImage] = useState<File | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  useEffect(() => { fetchClips(); }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (publicKey) { ensureUserTasks(publicKey.toString()); }
  }, [publicKey]);

  useEffect(() => {
    const walletAddress = publicKey?.toString();
    const channel = supabase
      .channel('discover-clips-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audio_clips' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newClip = payload.new as any;
          const mappedClip: AudioClip = {
            id: newClip.id, title: newClip.title, creator: newClip.creator,
            audioUrl: newClip.audio_url, coverImageUrl: newClip.cover_image_url || null,
            category: newClip.category || "Other", likes: newClip.likes || 0,
            shares: newClip.shares || 0, plays: newClip.plays || 0,
            createdAt: newClip.created_at, hasLiked: false,
          };
          setClips(prev => [mappedClip, ...prev.filter(c => c.id !== newClip.id)]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as any;
          setClips(prev => prev.map(clip => 
            clip.id === updated.id 
              ? { ...clip, likes: updated.likes || 0, shares: updated.shares || 0, plays: updated.plays || 0 }
              : clip
          ));
        } else if (payload.eventType === 'DELETE') {
          setClips(prev => prev.filter(clip => clip.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [publicKey]);

  useEffect(() => { filterClips(); }, [selectedCategory, clips]);

  const fetchClips = async () => {
    try {
      const { data: clipsData, error } = await supabase
        .from("audio_clips").select("*").order("created_at", { ascending: false });
      if (error) throw error;

      const { data: tokensData } = await supabase
        .from("tokens").select("id, audio_clip_id, mint_address, is_remix").not("audio_clip_id", "is", null);

      const mintedClipsMap = new Map<string, { tokenId: string; mintAddress: string }>();
      (tokensData || []).forEach((token: any) => {
        if (token.audio_clip_id && !token.is_remix) {
          mintedClipsMap.set(token.audio_clip_id, { tokenId: token.id, mintAddress: token.mint_address });
        }
      });

      const mappedClips: AudioClip[] = (clipsData || []).map((clip) => {
        const mintedInfo = mintedClipsMap.get(clip.id);
        return {
          id: clip.id, title: clip.title, creator: clip.creator, audioUrl: clip.audio_url,
          coverImageUrl: clip.cover_image_url || null, category: clip.category || "Other",
          likes: clip.likes || 0, shares: clip.shares || 0, plays: clip.plays || 0,
          createdAt: clip.created_at, hasLiked: false,
          mintedTokenId: mintedInfo?.tokenId || null, mintAddress: mintedInfo?.mintAddress || null,
        };
      });

      setClips(mappedClips);
    } catch (error) {
      console.error("Error fetching clips:", error);
      toast.error("Failed to load clips");
    } finally {
      setLoadingClips(false);
    }
  };

  const filterClips = () => {
    if (selectedCategory === "All") { setFilteredClips(clips); }
    else { setFilteredClips(clips.filter((clip) => clip.category === selectedCategory)); }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle || !uploadCoverImage) {
      toast.error("Please fill all fields including cover image!");
      return;
    }
    setLoading(true);
    try {
      const walletAddress = publicKey?.toString() || null;
      const creatorName = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-3)}` : "Anonymous";

      toast.info("Uploading audio to IPFS...");
      const audioFormData = new FormData();
      audioFormData.append('file', uploadFile);
      audioFormData.append('fileName', `${uploadTitle.replace(/[^a-zA-Z0-9]/g, '_')}.${uploadFile.name.split('.').pop()}`);

      const { data: audioFuncData, error: audioFuncError } = await supabase.functions.invoke('upload-to-ipfs', { body: audioFormData });
      if (audioFuncError || !audioFuncData?.success) throw new Error(audioFuncData?.error || 'Failed to upload audio');

      toast.info("Uploading cover image to IPFS...");
      const imageFormData = new FormData();
      imageFormData.append('file', uploadCoverImage);
      imageFormData.append('fileName', `${uploadTitle.replace(/[^a-zA-Z0-9]/g, '_')}_cover.${uploadCoverImage.name.split('.').pop()}`);

      const { data: imageFuncData, error: imageFuncError } = await supabase.functions.invoke('upload-to-ipfs', { body: imageFormData });
      if (imageFuncError || !imageFuncData?.success) throw new Error(imageFuncData?.error || 'Failed to upload image');

      const { error } = await supabase.from("audio_clips").insert({
        title: uploadTitle, creator: creatorName, audio_url: audioFuncData.url,
        cover_image_url: imageFuncData.url, category: uploadCategory, wallet_address: walletAddress,
        likes: 0, shares: 0, plays: 0,
      });
      if (error) throw error;

      toast.success("Audio clip uploaded!");
      setShowUploadModal(false);
      setUploadTitle(""); setUploadFile(null); setUploadCoverImage(null);
      if (walletAddress) await updateTaskProgress(walletAddress, "upload_clip", 1);
    } catch (error) {
      console.error("Error uploading clip:", error);
      toast.error("Failed to upload clip");
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    const newLikes = clip.hasLiked ? clip.likes - 1 : clip.likes + 1;
    setClips(clips.map((c) => c.id === clipId ? { ...c, likes: newLikes, hasLiked: !c.hasLiked } : c));
    try {
      await supabase.from("audio_clips").update({ likes: newLikes }).eq("id", clipId);
      if (publicKey && !clip.hasLiked) {
        await supabase.from("user_interactions").insert({ wallet_address: publicKey.toString(), audio_clip_id: clipId, interaction_type: "like" });
        await updateTaskProgress(publicKey.toString(), "like_clips", 1);
      }
    } catch (error) { console.error("Error updating like:", error); }
  };

  const handleShare = async (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (clip) {
      navigator.clipboard.writeText(`${window.location.origin}/explore?tab=clips&clip=${clipId}`);
      toast.success("Link copied!");
      const newShares = clip.shares + 1;
      setClips(clips.map((c) => (c.id === clipId ? { ...c, shares: newShares } : c)));
      try {
        await supabase.from("audio_clips").update({ shares: newShares }).eq("id", clipId);
        if (publicKey) {
          await supabase.from("user_interactions").insert({ wallet_address: publicKey.toString(), audio_clip_id: clipId, interaction_type: "share" });
          await updateTaskProgress(publicKey.toString(), "share_clips", 1);
        }
      } catch (error) { console.error("Error updating share:", error); }
    }
  };

  const handlePlay = async (clipId: string) => {
    const wasPlaying = playingClip === clipId;
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (wasPlaying) { setPlayingClip(null); return; }

    setPlayingClip(clipId);
    try {
      const audio = new Audio(clip.audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setPlayingClip(null); audioRef.current = null; };
      audio.onerror = () => { toast.error("Failed to play audio"); setPlayingClip(null); audioRef.current = null; };
      await audio.play();

      const newPlays = clip.plays + 1;
      setClips(clips.map((c) => (c.id === clipId ? { ...c, plays: newPlays } : c)));
      await supabase.from("audio_clips").update({ plays: newPlays }).eq("id", clipId);

      if (publicKey) {
        await supabase.from("user_interactions").insert({ wallet_address: publicKey.toString(), audio_clip_id: clipId, interaction_type: "play" });
        await updateTaskProgress(publicKey.toString(), "listen_clips", 1);
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      toast.error("Failed to play audio");
      setPlayingClip(null);
    }
  };

  const handleMintClick = (clip: AudioClip) => {
    localStorage.setItem("noizlabs_mint_audio", JSON.stringify({
      id: clip.id, title: clip.title, audioUrl: clip.audioUrl, coverImageUrl: clip.coverImageUrl, category: clip.category,
    }));
    navigate("/create");
    toast.success("Audio loaded! Complete the form to mint.");
  };

  const handleRemixClick = (clip: AudioClip) => {
    localStorage.setItem("noizlabs_mint_audio", JSON.stringify({
      id: clip.id, title: `${clip.title} (Remix)`, audioUrl: clip.audioUrl, coverImageUrl: clip.coverImageUrl,
      category: clip.category, isRemix: true, originalTokenId: clip.mintedTokenId, originalMintAddress: clip.mintAddress,
    }));
    navigate("/create");
    toast.success("Creating remix! Original creator earns 10% royalties.");
  };

  return (
    <div>
      {/* Top Clips */}
      <TopClipsSection />

      {/* Category Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4">
        {CATEGORIES.map((cat) => (
          <Button key={cat} onClick={() => setSelectedCategory(cat)} variant={selectedCategory === cat ? "default" : "outline"} size="sm" className="text-xs whitespace-nowrap">
            {cat}
          </Button>
        ))}
      </div>

      {/* Clips Grid */}
      {loadingClips ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        </div>
      ) : filteredClips.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground text-sm">No clips in this category</p>
          <Button size="sm" className="mt-2" onClick={() => setShowUploadModal(true)}>Upload First</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredClips.map((clip) => (
            <div key={clip.id} className="bg-card rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-colors">
              {/* Cover Image */}
              <div 
                className="relative h-28 bg-muted cursor-pointer"
                onClick={() => clip.coverImageUrl && setLightboxImage(clip.coverImageUrl)}
              >
                {clip.coverImageUrl ? (
                  <img src={clip.coverImageUrl} alt={clip.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                    <span className="text-3xl">🎵</span>
                  </div>
                )}
                {/* Play button - always visible on mobile, hover on desktop */}
                <button
                  onClick={(e) => { e.stopPropagation(); handlePlay(clip.id); }}
                  className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                    playingClip === clip.id 
                      ? "bg-black/40 opacity-100" 
                      : "bg-black/30 opacity-100 md:opacity-0 md:hover:opacity-100"
                  }`}
                >
                  {playingClip === clip.id ? (
                    <Pause className="w-8 h-8 text-white animate-pulse" />
                  ) : (
                    <Play className="w-8 h-8 text-white ml-1" />
                  )}
                </button>
              </div>

              {/* Info */}
              <div className="p-2.5">
                <p className="font-semibold text-sm truncate">{clip.title}</p>
                <p className="text-xs text-muted-foreground truncate">{clip.creator}</p>
                
                {/* Stats Row */}
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{clip.plays} plays</span>
                  <span>•</span>
                  <span>{clip.likes} likes</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-2">
                  <Button size="sm" variant={clip.hasLiked ? "destructive" : "outline"} className="h-7 px-2" onClick={() => handleLike(clip.id)}>
                    <Heart className={`w-3 h-3 ${clip.hasLiked ? "fill-current" : ""}`} />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleShare(clip.id)}>
                    <Share2 className="w-3 h-3" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 px-2 ml-auto">
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      {clip.mintedTokenId ? (
                        <DropdownMenuItem onClick={() => navigate(`/trade?mint=${clip.mintAddress}`)}>
                          <ArrowRightLeft className="w-3 h-3 mr-2" />Trade
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleMintClick(clip)}>
                          <Coins className="w-3 h-3 mr-2" />Mint Token
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Audio Clip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-medium">Title <span className="text-destructive">*</span></Label>
              <Input type="text" placeholder="My Audio" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} className="mt-1 h-10" />
            </div>
            <div>
              <Label className="text-xs font-medium">Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">
                Cover Image <span className="text-destructive">*</span>
              </Label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => uploadCoverInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    uploadCoverInputRef.current?.click();
                  }
                }}
                className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center relative overflow-hidden cursor-pointer"
                aria-label="Select cover image"
              >
                <input
                  ref={uploadCoverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUploadCoverImage(e.target.files?.[0] || null)}
                  className="absolute inset-0 z-10 w-full h-full cursor-pointer opacity-0"
                />
                <div className="pointer-events-none">
                  {uploadCoverImage ? (
                    <p className="text-sm font-medium text-foreground">✅ {uploadCoverImage.name}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Tap to select cover image</p>
                  )}
                </div>
                {uploadCoverImage && (
                  <>
                    <img
                      src={URL.createObjectURL(uploadCoverImage)}
                      alt="Cover image preview"
                      className="mt-2 w-full h-24 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadCoverImage(null);
                        if (uploadCoverInputRef.current) uploadCoverInputRef.current.value = "";
                      }}
                      className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/80 transition-colors z-20"
                      aria-label="Remove cover image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">
                Audio File <span className="text-destructive">*</span>
              </Label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => uploadAudioInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    uploadAudioInputRef.current?.click();
                  }
                }}
                className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center relative overflow-hidden cursor-pointer"
                aria-label="Select audio file"
              >
                <input
                  ref={uploadAudioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 z-10 w-full h-full cursor-pointer opacity-0"
                />
                <div className="pointer-events-none">
                  {uploadFile ? (
                    <p className="text-sm font-medium text-foreground">✅ {uploadFile.name}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Tap to select audio file</p>
                  )}
                </div>
                {uploadFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadFile(null);
                      if (uploadAudioInputRef.current) uploadAudioInputRef.current.value = "";
                    }}
                    className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/80 transition-colors z-20"
                    aria-label="Remove audio file"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            {uploadFile && (
              <audio controls className="w-full h-10">
                <source src={URL.createObjectURL(uploadFile)} type={uploadFile.type} />
              </audio>
            )}
            <Button onClick={handleUpload} disabled={loading || !uploadTitle || !uploadFile || !uploadCoverImage} className="w-full h-11">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading...</> : <><Upload className="w-4 h-4 mr-2" />Upload Clip</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <ImageLightbox src={lightboxImage} alt={lightboxAlt} isOpen={!!lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
};

export default ClipsTab;
