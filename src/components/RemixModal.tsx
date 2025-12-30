import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertCircle
} from "lucide-react";

interface RemixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenId: string;
  mintAddress: string;
  tokenName: string;
}

interface RemixVariation {
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  isFree: boolean;
  isCreated?: boolean;
  remixConcept?: string;
}

// Platform fee wallet for remix payments
const REMIX_FEE_WALLET = new PublicKey("5NC3whTedkRHALefgSPjRmV2WEfFMczBNQ2sYT4EdoD7");
const REMIX_COST_SOL = 0.01;

export const RemixModal = ({ open, onOpenChange, tokenId, mintAddress, tokenName }: RemixModalProps) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [variations, setVariations] = useState<RemixVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [remixing, setRemixing] = useState<string | null>(null);
  const [selectedRemix, setSelectedRemix] = useState<RemixVariation | null>(null);

  const baseVariations: Omit<RemixVariation, 'isCreated' | 'remixConcept'>[] = [
    { type: "slow", name: "Slow", description: "Slowed down with dreamy vibes", icon: <Music className="w-5 h-5" />, isFree: true },
    { type: "reverb", name: "Reverb", description: "Heavy reverb, spacious atmosphere", icon: <Waves className="w-5 h-5" />, isFree: true },
    { type: "distorted", name: "Distorted", description: "Crunchy distortion, aggressive edge", icon: <Zap className="w-5 h-5" />, isFree: true },
    { type: "lofi", name: "Lo-Fi", description: "Lo-fi hip hop with vinyl crackle", icon: <Radio className="w-5 h-5" />, isFree: false },
    { type: "vaporwave", name: "Vaporwave", description: "Aesthetic slowed vaporwave", icon: <Sparkles className="w-5 h-5" />, isFree: false },
    { type: "nightcore", name: "Nightcore", description: "Sped up with high energy", icon: <FastForward className="w-5 h-5" />, isFree: false },
  ];

  useEffect(() => {
    if (open && tokenId) {
      fetchExistingRemixes();
    }
  }, [open, tokenId]);

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
      }));

      setVariations(updatedVariations);
    } catch (error) {
      console.error("Error fetching remixes:", error);
      toast.error("Failed to load remix data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRemix = async (variation: RemixVariation) => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (variation.isCreated) {
      setSelectedRemix(variation);
      return;
    }

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
        
        // Wait for confirmation
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        paymentTxSignature = signature;
        toast.success("Payment confirmed!");
      }

      // Call the remix edge function
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
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create remix");
      }

      toast.success(`${variation.name} remix created!`);
      
      // Refresh the list
      await fetchExistingRemixes();
      
      // Show the created remix
      setSelectedRemix({
        ...variation,
        isCreated: true,
        remixConcept: data.remix?.remix_concept,
      });

    } catch (error) {
      console.error("Error creating remix:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create remix");
    } finally {
      setRemixing(null);
    }
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
          // Show remix details
          <div className="space-y-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedRemix(null)}
              className="mb-2"
            >
              ← Back to variations
            </Button>
            
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                {selectedRemix.icon}
                <div>
                  <h3 className="font-semibold">{selectedRemix.name} Remix</h3>
                  <p className="text-sm text-muted-foreground">{selectedRemix.description}</p>
                </div>
              </div>
              
              {selectedRemix.remixConcept && (
                <div className="mt-4 p-3 bg-background/50 rounded-md">
                  <h4 className="text-sm font-medium mb-2">AI Remix Concept:</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedRemix.remixConcept}
                  </p>
                </div>
              )}

              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Full audio generation coming soon! For now, enjoy the AI-generated remix concept.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Show variation grid
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create unique AI-powered remix variations. Each token can have one remix per style.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {variations.map((variation) => (
                <button
                  key={variation.type}
                  onClick={() => handleCreateRemix(variation)}
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
                    {variation.isCreated ? (
                      <Badge variant="secondary" className="text-xs">
                        <Check className="w-3 h-3 mr-1" />
                        Created
                      </Badge>
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
                  <h3 className="font-medium text-sm">{variation.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{variation.description}</p>
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
