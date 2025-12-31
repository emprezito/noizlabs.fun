import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Music, 
  Zap, 
  Waves, 
  Radio, 
  Sparkles, 
  FastForward,
  Loader2,
  Lock,
  Check,
  AlertCircle,
  Play,
  Pause,
  Volume2,
  Coins
} from "lucide-react";

interface RemixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenId: string;
  mintAddress: string;
  tokenName: string;
  originalAudioUrl?: string;
  coverImageUrl?: string;
}

interface RemixVariation {
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  isFree: boolean;
  speedFactor: number;
  isCreated?: boolean;
  remixConcept?: string;
  remixAudioUrl?: string | null;
}

interface RemixAudioData {
  original: string;
  effect: string;
  speedFactor: number;
  variationType: string;
}

// Platform fee wallet for remix payments
const REMIX_FEE_WALLET = new PublicKey("5NC3whTedkRHALefgSPjRmV2WEfFMczBNQ2sYT4EdoD7");
const REMIX_COST_SOL = 0.01;

export const RemixModal = ({ 
  open, 
  onOpenChange, 
  tokenId, 
  mintAddress, 
  tokenName,
  originalAudioUrl,
  coverImageUrl 
}: RemixModalProps) => {
  const navigate = useNavigate();
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [variations, setVariations] = useState<RemixVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [remixing, setRemixing] = useState<string | null>(null);
  const [selectedRemix, setSelectedRemix] = useState<RemixVariation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [effectVolume, setEffectVolume] = useState(0.4);
  
  const originalAudioRef = useRef<HTMLAudioElement | null>(null);
  const effectAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const baseVariations: Omit<RemixVariation, 'isCreated' | 'remixConcept' | 'remixAudioUrl'>[] = [
    { type: "slow", name: "Slow", description: "Slowed down with dreamy vibes", icon: <Music className="w-5 h-5" />, isFree: true, speedFactor: 0.75 },
    { type: "reverb", name: "Reverb", description: "Heavy reverb, spacious atmosphere", icon: <Waves className="w-5 h-5" />, isFree: true, speedFactor: 1.0 },
    { type: "distorted", name: "Distorted", description: "Crunchy distortion, aggressive edge", icon: <Zap className="w-5 h-5" />, isFree: true, speedFactor: 1.0 },
    { type: "lofi", name: "Lo-Fi", description: "Lo-fi hip hop with vinyl crackle", icon: <Radio className="w-5 h-5" />, isFree: false, speedFactor: 0.9 },
    { type: "vaporwave", name: "Vaporwave", description: "Aesthetic slowed vaporwave", icon: <Sparkles className="w-5 h-5" />, isFree: false, speedFactor: 0.7 },
    { type: "nightcore", name: "Nightcore", description: "Sped up with high energy", icon: <FastForward className="w-5 h-5" />, isFree: false, speedFactor: 1.3 },
  ];

  useEffect(() => {
    if (open && tokenId) {
      fetchExistingRemixes();
      setSelectedRemix(null);
    }
    // Cleanup audio on close
    if (!open) {
      stopAllAudio();
    }
  }, [open, tokenId]);

  const stopAllAudio = useCallback(() => {
    if (originalAudioRef.current) {
      originalAudioRef.current.pause();
      originalAudioRef.current = null;
    }
    if (effectAudioRef.current) {
      effectAudioRef.current.pause();
      effectAudioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const fetchExistingRemixes = async () => {
    setLoading(true);
    try {
      const { data: remixes } = await supabase
        .from("token_remixes")
        .select("*")
        .eq("token_id", tokenId);

      const remixMap = new Map(remixes?.map(r => [r.variation_type, r]) || []);

      const updatedVariations = baseVariations.map(v => ({
        ...v,
        isCreated: remixMap.has(v.type),
        remixConcept: remixMap.get(v.type)?.remix_concept,
        remixAudioUrl: remixMap.get(v.type)?.remix_audio_url,
      }));

      setVariations(updatedVariations);
    } catch (error) {
      console.error("Error fetching remixes:", error);
      toast.error("Failed to load remix data");
    } finally {
      setLoading(false);
    }
  };

  const parseRemixAudioData = (audioUrl: string): RemixAudioData | null => {
    try {
      // Check if it's the new JSON format with original + effect
      if (audioUrl.startsWith('{')) {
        return JSON.parse(audioUrl);
      }
      return null;
    } catch {
      return null;
    }
  };

  const handlePlayPause = useCallback(async () => {
    if (!selectedRemix?.remixAudioUrl) return;

    if (isPlaying) {
      stopAllAudio();
      return;
    }

    try {
      const remixData = parseRemixAudioData(selectedRemix.remixAudioUrl);
      
      if (remixData) {
        // New format: Play original audio with speed adjustment + effect layer
        originalAudioRef.current = new Audio(remixData.original);
        effectAudioRef.current = new Audio(remixData.effect);
        
        // Apply speed adjustment to original audio
        originalAudioRef.current.playbackRate = remixData.speedFactor;
        
        // Set volumes
        originalAudioRef.current.volume = 0.8;
        effectAudioRef.current.volume = effectVolume;
        
        // Sync playback
        originalAudioRef.current.onended = () => {
          stopAllAudio();
        };
        
        // Play both simultaneously
        await Promise.all([
          originalAudioRef.current.play(),
          effectAudioRef.current.play()
        ]);
        
        setIsPlaying(true);
      } else {
        // Old format or fallback: Just play the audio URL
        originalAudioRef.current = new Audio(selectedRemix.remixAudioUrl);
        originalAudioRef.current.playbackRate = selectedRemix.speedFactor;
        originalAudioRef.current.onended = () => setIsPlaying(false);
        await originalAudioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Error playing remix:", error);
      toast.error("Failed to play remix audio");
      stopAllAudio();
    }
  }, [selectedRemix, effectVolume, stopAllAudio, isPlaying]);

  // Update effect volume in real-time
  useEffect(() => {
    if (effectAudioRef.current && isPlaying) {
      effectAudioRef.current.volume = effectVolume;
    }
  }, [effectVolume, isPlaying]);

  const handleSelectVariation = async (variation: RemixVariation) => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    // Stop any playing audio
    stopAllAudio();

    // If already created, show it
    if (variation.isCreated) {
      setSelectedRemix(variation);
      return;
    }

    // Otherwise, generate the remix automatically
    await generateRemix(variation);
  };

  const generateRemix = async (variation: RemixVariation) => {
    if (!connected || !publicKey) return;

    setRemixing(variation.type);

    try {
      let paymentTxSignature: string | null = null;

      // Handle payment for non-free variations
      if (!variation.isFree) {
        toast.info(`Processing payment of ${REMIX_COST_SOL} SOL...`);
        
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: REMIX_FEE_WALLET,
            lamports: Math.floor(REMIX_COST_SOL * LAMPORTS_PER_SOL),
          })
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signature = await sendTransaction(transaction, connection);
        
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        paymentTxSignature = signature;
        toast.success("Payment confirmed!");
      }

      // Call the remix edge function with original audio URL
      toast.info("Generating remix with AI...");
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remix-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            tokenId,
            mintAddress,
            variationType: variation.type,
            walletAddress: publicKey.toString(),
            paymentTxSignature,
            originalAudioUrl, // Pass the original audio URL for processing
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create remix");
      }

      const hasAudio = data.hasAudio || !!data.remix?.remix_audio_url;
      toast.success(hasAudio 
        ? `${variation.name} remix with audio created!` 
        : `${variation.name} remix created!`
      );
      
      // Refresh the list
      await fetchExistingRemixes();
      
      // Show the created remix immediately
      const createdRemix: RemixVariation = {
        ...variation,
        isCreated: true,
        remixConcept: data.remix?.remix_concept,
        remixAudioUrl: data.remix?.remix_audio_url,
      };
      
      setSelectedRemix(createdRemix);

    } catch (error) {
      console.error("Error creating remix:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create remix");
    } finally {
      setRemixing(null);
    }
  };

  const handleMintAsToken = () => {
    if (!selectedRemix || !selectedRemix.remixAudioUrl) {
      toast.error("No remix audio available to mint");
      return;
    }

    // Get the playable audio URL for minting
    let audioUrlForMint = selectedRemix.remixAudioUrl;
    const remixData = parseRemixAudioData(selectedRemix.remixAudioUrl);
    if (remixData) {
      // For the new format, we'll use the original with speed factor for minting
      // In production, you'd want to actually process the audio server-side
      audioUrlForMint = remixData.original;
    }

    // Prepare data for the Create page with variation prefix
    const remixTitle = `${selectedRemix.name} - ${tokenName}`;
    
    const mintData = {
      title: remixTitle,
      audioUrl: audioUrlForMint,
      coverImageUrl: coverImageUrl || null,
      isRemix: true,
      originalTokenId: tokenId,
      originalMintAddress: mintAddress,
      variationType: selectedRemix.type,
      speedFactor: selectedRemix.speedFactor,
    };

    // Store in localStorage for Create page to pick up
    localStorage.setItem("noizlabs_mint_audio", JSON.stringify(mintData));
    
    // Close modal and navigate to create page
    onOpenChange(false);
    navigate("/create");
    toast.success(`Ready to mint "${remixTitle}" as a new token!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Remix: {tokenName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : selectedRemix ? (
          // Show remix details with playback and mint option
          <div className="space-y-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                stopAllAudio();
                setSelectedRemix(null);
              }}
              className="mb-2"
            >
              ← Back to variations
            </Button>
            
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                {selectedRemix.icon}
                <div>
                  <h3 className="font-semibold">{selectedRemix.name} - {tokenName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedRemix.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Speed: {selectedRemix.speedFactor}x
                  </p>
                </div>
              </div>

              {/* Audio Player */}
              {selectedRemix.remixAudioUrl ? (
                <div className="mt-4 p-3 bg-background/50 rounded-md space-y-3">
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handlePlayPause}
                      className="flex items-center gap-2"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Play Remix
                        </>
                      )}
                    </Button>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Volume2 className="w-4 h-4" />
                      <span>AI Remixed Audio</span>
                    </div>
                  </div>
                  
                  {/* Effect Volume Slider */}
                  {parseRemixAudioData(selectedRemix.remixAudioUrl) && (
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Effect Layer Volume</label>
                      <Slider
                        value={[effectVolume]}
                        onValueChange={([v]) => setEffectVolume(v)}
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Audio generation is currently disabled. Ask admin to enable "AI Audio Remix" feature.
                  </p>
                </div>
              )}
              
              {selectedRemix.remixConcept && (
                <div className="mt-4 p-3 bg-background/50 rounded-md">
                  <h4 className="text-sm font-medium mb-2">AI Remix Concept:</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedRemix.remixConcept}
                  </p>
                </div>
              )}
            </div>

            {/* Mint as Token Button */}
            {selectedRemix.remixAudioUrl && (
              <Button 
                onClick={handleMintAsToken}
                className="w-full bg-primary hover:bg-primary/90"
                size="lg"
              >
                <Coins className="w-5 h-5 mr-2" />
                Mint as New Token
              </Button>
            )}
            
            <p className="text-xs text-muted-foreground text-center">
              Minting creates a new token with this remix. Original creator earns 10% royalty on trades.
            </p>
          </div>
        ) : (
          // Show variation grid
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a remix style to automatically generate the audio with AI. The original audio will be processed with the selected effect.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {variations.map((variation) => (
                <button
                  key={variation.type}
                  onClick={() => handleSelectVariation(variation)}
                  disabled={remixing !== null}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    variation.isCreated
                      ? "bg-primary/10 border-primary/30 hover:border-primary/50"
                      : "bg-card border-border hover:border-primary/50 hover:bg-primary/5"
                  } ${remixing === variation.type ? "opacity-70" : ""}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-2 rounded-md ${variation.isCreated ? "bg-primary/20" : "bg-muted"}`}>
                      {remixing === variation.type ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        variation.icon
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {variation.isCreated ? (
                        <>
                          <Badge variant="secondary" className="text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Created
                          </Badge>
                          {variation.remixAudioUrl && (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                              <Volume2 className="w-3 h-3 mr-1" />
                              Audio
                            </Badge>
                          )}
                        </>
                      ) : !variation.isFree ? (
                        <Badge variant="outline" className="text-xs">
                          <Lock className="w-3 h-3 mr-1" />
                          0.01 SOL
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                          Free
                        </Badge>
                      )}
                    </div>
                  </div>
                  <h3 className="font-medium text-sm">{variation.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{variation.description}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Speed: {variation.speedFactor}x</p>
                </button>
              ))}
            </div>

            <div className="text-xs text-muted-foreground text-center pt-2">
              First 3 variations are free • Premium variations cost 0.01 SOL each
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
