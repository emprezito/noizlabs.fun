import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AppLayout } from "@/components/AppLayout";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, TrendingUp, RefreshCw, Loader2, Gem, Clock, LayoutGrid, Filter } from "lucide-react";
import { toast } from "sonner";
import { SoundCard } from "@/components/browse/SoundCard";
import { LiveActivityFeed } from "@/components/browse/LiveActivityFeed";
import { MintSoundModal } from "@/components/browse/MintSoundModal";
import { useSoundBrowser, useSoundPlayer, SOUND_CATEGORIES, type SoundWithStatus, type SoundTab } from "@/hooks/useSoundBrowser";
import { useSoundReservation } from "@/hooks/useSoundReservation";
import { createTokenWithMetaplex, CreateTokenParams, PLATFORM_WALLET, TOTAL_SUPPLY } from "@/lib/solana/createToken";
import { uploadTokenMetadata } from "@/lib/ipfsUpload";
import { updateTaskProgress } from "@/lib/taskUtils";
import { supabase } from "@/integrations/supabase/client";

const BrowseSoundsPage = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { playingId, play } = useSoundPlayer();

  const {
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    selectedCategory,
    setSelectedCategory,
    sounds,
    isLoading,
    error,
    retry,
    refetchRegistry,
  } = useSoundBrowser();

  const {
    reservation,
    isReserving,
    timeLeft,
    formatTimeLeft,
    reserve,
    releaseReservation,
    completeMint,
  } = useSoundReservation(refetchRegistry);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSound, setSelectedSound] = useState<SoundWithStatus | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<{ tokenAddress: string; tokenName: string; tokenTicker: string } | null>(null);

  const handleMintClick = useCallback(async (sound: SoundWithStatus) => {
    if (!connected || !publicKey) {
      toast.error("Connect your wallet first!");
      return;
    }

    const success = await reserve(sound);
    if (success) {
      setSelectedSound(sound);
      setMintResult(null);
      setModalOpen(true);
    }
  }, [connected, publicKey, reserve]);

  const handleSubmitMint = useCallback(async (name: string, ticker: string, description: string) => {
    if (!publicKey || !reservation || !selectedSound) return;

    setIsMinting(true);
    try {
      toast.info("Uploading to IPFS...");
      const uploadResult = await uploadTokenMetadata(
        null,
        null,
        { name, symbol: ticker, description },
        selectedSound.mp3,
        null
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "IPFS upload failed");
      }

      toast.success("Files uploaded!");

      const metadataUri = uploadResult.url!;
      const mintKeypair = Keypair.generate();

      const params: CreateTokenParams = {
        name: name.slice(0, 32),
        symbol: ticker.slice(0, 10),
        metadataUri: metadataUri.slice(0, 200),
        totalSupply: BigInt(1_000_000_000 * 1e9),
      };

      toast.info("Creating token on Solana...");
      const transaction = await createTokenWithMetaplex(connection, publicKey, mintKeypair, params);

      const signature = await sendTransaction(transaction, connection, { signers: [mintKeypair] });
      await connection.confirmTransaction(signature, "confirmed");

      const mintAddr = mintKeypair.publicKey.toString();
      const walletAddress = publicKey.toString();

      toast.info("Transferring to bonding curve...");
      try {
        const mintPubkey = mintKeypair.publicKey;
        const creatorATA = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const platformATA = await getAssociatedTokenAddress(mintPubkey, PLATFORM_WALLET);
        const bondingCurveAllocation = (TOTAL_SUPPLY * BigInt(95)) / BigInt(100);

        const transferTx = new Transaction();
        const platformATAInfo = await connection.getAccountInfo(platformATA);
        if (!platformATAInfo) {
          transferTx.add(createAssociatedTokenAccountInstruction(publicKey, platformATA, PLATFORM_WALLET, mintPubkey));
        }
        transferTx.add(createTransferInstruction(creatorATA, platformATA, publicKey, bondingCurveAllocation, [], TOKEN_PROGRAM_ID));
        transferTx.feePayer = publicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        transferTx.recentBlockhash = blockhash;

        const transferSig = await sendTransaction(transferTx, connection);
        await connection.confirmTransaction(transferSig, "confirmed");
      } catch (transferErr) {
        console.error("Token transfer error:", transferErr);
      }

      const initialSolReserves = 25_000_000_000;
      const initialTokenReserves = 950_000_000_000_000_000;
      const finalAudioUrl = uploadResult.audioUrl || selectedSound.mp3;
      const creatorAllocation = (BigInt(1_000_000_000) * BigInt(1e9) * BigInt(5)) / BigInt(100);
      const cliffEnd = new Date();
      cliffEnd.setDate(cliffEnd.getDate() + 21);

      await supabase.functions.invoke("manage-user-data", {
        body: {
          action: "create_token_record",
          tokenData: {
            mintAddress: mintAddr,
            name: name.slice(0, 32),
            symbol: ticker.slice(0, 10),
            creatorWallet: walletAddress,
            metadataUri,
            audioUrl: finalAudioUrl,
            solReserves: initialSolReserves,
            tokenReserves: initialTokenReserves,
            isRemix: false,
          },
          vestingData: {
            vestingWallet: walletAddress,
            tokenAmount: creatorAllocation.toString(),
            cliffEnd: cliffEnd.toISOString(),
          },
        },
      });

      await completeMint(name, ticker, mintAddr);
      await updateTaskProgress(walletAddress, "mint_token", 1);

      setMintResult({ tokenAddress: mintAddr, tokenName: name, tokenTicker: ticker });
      toast.success("Token minted! You own this sound forever 🔒");
    } catch (err: any) {
      console.error("Mint error:", err);
      toast.error(err.message || "Mint failed");
      releaseReservation();
      setModalOpen(false);
    } finally {
      setIsMinting(false);
    }
  }, [publicKey, reservation, selectedSound, connection, sendTransaction, completeMint, releaseReservation]);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Browse & Mint Sounds
          </h1>
          <p className="text-muted-foreground mt-1">
            First Come, First Served — mint any sound as a Solana token before someone else does
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search sounds... (e.g. bruh, airhorn, vine)"
                className="pl-10"
              />
            </div>

            {/* Tabs + Category Filter */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as SoundTab); if (v !== "search") setSearchQuery(""); }}>
                <TabsList>
                  <TabsTrigger value="all">
                    <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                    All Sounds
                  </TabsTrigger>
                  <TabsTrigger value="trending">
                    <TrendingUp className="w-3.5 h-3.5 mr-1" />
                    Trending
                  </TabsTrigger>
                  <TabsTrigger value="recent">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    Recent
                  </TabsTrigger>
                  <TabsTrigger value="search" disabled={!searchQuery}>
                    <Search className="w-3.5 h-3.5 mr-1" />
                    Results
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {activeTab === "all" && (
                <Select value={selectedCategory || "__all__"} onValueChange={v => setSelectedCategory(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="w-[180px] h-9">
                    <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOUND_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value || "__all__"}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <p className="text-muted-foreground mb-3">Sounds unavailable right now 😔</p>
                <Button variant="outline" onClick={retry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {/* Sound Grid */}
            {!isLoading && !error && sounds.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {sounds.map(sound => (
                  <SoundCard
                    key={sound.id}
                    sound={sound}
                    isPlaying={playingId === sound.id}
                    onPlay={() => play(sound.id, sound.mp3)}
                    onMint={() => handleMintClick(sound)}
                    isMinting={isReserving}
                  />
                ))}
              </div>
            )}

            {/* Empty States */}
            {!isLoading && !error && sounds.length === 0 && activeTab === "search" && searchQuery && (
              <div className="text-center py-16 bg-card rounded-2xl border border-border">
                <Gem className="w-10 h-10 text-primary mx-auto mb-3" />
                <p className="text-foreground font-bold mb-1">No sounds found for &apos;{searchQuery}&apos;</p>
                <p className="text-muted-foreground text-sm">Try different keywords 💎</p>
              </div>
            )}

            {!isLoading && !error && sounds.length === 0 && activeTab !== "search" && (
              <div className="text-center py-16 bg-card rounded-2xl border border-border">
                <Gem className="w-10 h-10 text-primary mx-auto mb-3" />
                <p className="text-foreground font-bold mb-1">No sounds loaded</p>
                <p className="text-muted-foreground text-sm">Try refreshing or switching tabs</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <LiveActivityFeed />
          </div>
        </div>
      </div>

      <MintSoundModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        sound={selectedSound}
        timeLeft={timeLeft}
        formatTimeLeft={formatTimeLeft}
        onRelease={releaseReservation}
        onSubmitMint={handleSubmitMint}
        isMinting={isMinting}
        mintResult={mintResult}
      />

      <Footer />
    </AppLayout>
  );
};

export default BrowseSoundsPage;
