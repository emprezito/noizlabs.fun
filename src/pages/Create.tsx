import { useState, useRef, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Music, Image, Check, Loader2, AlertCircle, Shield, AlertTriangle } from "lucide-react";
import { createTokenWithMetaplex, CreateTokenParams, PLATFORM_WALLET, TOTAL_SUPPLY } from "@/lib/solana/createToken";
import { uploadTokenMetadata } from "@/lib/ipfsUpload";
import { useSolPrice } from "@/hooks/useSolPrice";
import { updateTaskProgress, ensureUserTasks } from "@/lib/taskUtils";
import { supabase } from "@/integrations/supabase/client";

type TokenCreationRoute = "bonding-curve" | "manual-lp";

const CreatePage = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { formatUsd } = useSolPrice();
  const [route, setRoute] = useState<TokenCreationRoute>("bonding-curve");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [disableMinting, setDisableMinting] = useState(false);
  const [disableFreezing, setDisableFreezing] = useState(false);
  const [makeImmutable, setMakeImmutable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingIPFS, setUploadingIPFS] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mintAddress, setMintAddress] = useState("");
  const [preloadedAudioUrl, setPreloadedAudioUrl] = useState<string | null>(null);
  const [preloadedClipId, setPreloadedClipId] = useState<string | null>(null);
  const [preloadedCoverImageUrl, setPreloadedCoverImageUrl] = useState<string | null>(null);
  const [isRemix, setIsRemix] = useState(false);
  const [originalTokenId, setOriginalTokenId] = useState<string | null>(null);
  const [originalMintAddress, setOriginalMintAddress] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Load audio from discover page if available
  useEffect(() => {
    const storedAudio = localStorage.getItem("noizlabs_mint_audio");
    if (storedAudio) {
      try {
        const audioData = JSON.parse(storedAudio);
        if (audioData.title) setName(audioData.title);
        if (audioData.audioUrl) setPreloadedAudioUrl(audioData.audioUrl);
        if (audioData.id) setPreloadedClipId(audioData.id);
        if (audioData.coverImageUrl) setPreloadedCoverImageUrl(audioData.coverImageUrl);
        if (audioData.isRemix) {
          setIsRemix(true);
          setOriginalTokenId(audioData.originalTokenId || null);
          setOriginalMintAddress(audioData.originalMintAddress || null);
        }
        if (audioData.title) {
          const generatedSymbol = audioData.title
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 6);
          setSymbol(generatedSymbol || "TOKEN");
        }
        localStorage.removeItem("noizlabs_mint_audio");
      } catch (e) {
        console.error("Error parsing stored audio:", e);
      }
    }
  }, []);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const calculateCost = () => {
    if (route === "bonding-curve") {
      return 0.02;
    } else {
      let cost = 0.5;
      if (disableMinting) cost += 0.1;
      if (disableFreezing) cost += 0.1;
      if (makeImmutable) cost += 0.1;
      return cost;
    }
  };

  const handleMint = async () => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first!");
      return;
    }

    // Check for audio - either uploaded file or preloaded from Discover page
    const hasAudio = audioFile || preloadedAudioUrl;
    if (!name || !symbol || !hasAudio) {
      toast.error("Please fill all required fields!");
      return;
    }

    setLoading(true);
    setUploadingIPFS(true);

    try {
      toast.info("Uploading files to IPFS...");
      const uploadResult = await uploadTokenMetadata(
        audioFile,
        imageFile,
        { name, symbol, description },
        preloadedAudioUrl,
        preloadedCoverImageUrl
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Failed to upload to IPFS");
      }

      setUploadingIPFS(false);
      toast.success("Files uploaded to IPFS!");
      
      const metadataUri = uploadResult.url!;
      
      // No length validation needed - Metaplex supports longer URIs
      const mintKeypair = Keypair.generate();

      const params: CreateTokenParams = {
        name: name.slice(0, 32),
        symbol: symbol.slice(0, 10),
        metadataUri: metadataUri.slice(0, 200),
        totalSupply: BigInt(1_000_000_000 * 1e9),
      };

      console.log("Creating token with standard SPL Token + Metaplex:", {
        name: params.name,
        symbol: params.symbol,
        metadataUri: params.metadataUri,
        totalSupply: params.totalSupply.toString(),
        mint: mintKeypair.publicKey.toString(),
        creator: publicKey.toString(),
      });

      toast.info("Creating token on Solana...");
      
      const transaction = await createTokenWithMetaplex(
        connection,
        publicKey,
        mintKeypair,
        params
      );
      
      console.log("Transaction created with SPL Token + Metaplex");
      console.log("Transaction instructions:", transaction.instructions.length);

      let signature: string;
      try {
        signature = await sendTransaction(transaction, connection, {
          signers: [mintKeypair],
        });
      } catch (walletErr: any) {
        console.error("Wallet Error Object:", walletErr);
        console.error("Wallet Error Message:", walletErr.message);
        console.error("Wallet Error Logs:", walletErr.logs);
        console.error("Wallet Error Name:", walletErr.name);
        
        // Extract the actual error message from the wallet error
        let errorMessage = walletErr.message || walletErr.toString() || "";
        
        // Check if there's an error property with simulation details
        if (walletErr.error) {
          errorMessage = typeof walletErr.error === 'string' ? walletErr.error : JSON.stringify(walletErr.error);
        }
        
        // Ensure errorMessage is a string before calling string methods
        if (typeof errorMessage !== 'string') {
          errorMessage = String(errorMessage);
        }
        
        // Parse simulation failed message for user-friendly display
        if (errorMessage.includes("Simulation failed")) {
          const logsMatch = errorMessage.match(/Logs:\s*\[([\s\S]*?)\]/);
          if (logsMatch) {
            const logs = logsMatch[1];
            if (logs.includes("Access violation")) {
              throw new Error("Solana Program Error: The on-chain program crashed with a memory access violation. This is a bug in the deployed Solana program, not your transaction. The program may need to be redeployed with fixes.");
            }
            if (logs.includes("custom program error")) {
              const errorCode = logs.match(/custom program error: (0x[0-9a-fA-F]+)/)?.[1];
              throw new Error(`Solana Program Error: Custom error ${errorCode || 'unknown'}. Check program logs for details.`);
            }
          }
          throw new Error(errorMessage);
        }
        
        throw walletErr;
      }
      
      await connection.confirmTransaction(signature, "confirmed");

      const walletAddress = publicKey.toString();
      const mintAddr = mintKeypair.publicKey.toString();

      // Step 2: Transfer 95% of tokens to platform wallet for bonding curve
      toast.info("Transferring tokens to bonding curve...");
      
      try {
        const mintPubkey = mintKeypair.publicKey;
        const creatorATA = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const platformATA = await getAssociatedTokenAddress(mintPubkey, PLATFORM_WALLET);
        
        const bondingCurveAllocation = (TOTAL_SUPPLY * BigInt(95)) / BigInt(100); // 95% to platform
        
        const transferTx = new Transaction();
        
        // Create platform ATA if needed
        const platformATAInfo = await connection.getAccountInfo(platformATA);
        if (!platformATAInfo) {
          transferTx.add(
            createAssociatedTokenAccountInstruction(
              publicKey, // payer
              platformATA,
              PLATFORM_WALLET,
              mintPubkey
            )
          );
        }
        
        // Transfer 95% to platform wallet
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
        
        console.log("Transferred 95% tokens to platform wallet:", transferSig);
      } catch (transferErr: any) {
        console.error("Token transfer error:", transferErr);
        toast.error("Token created but failed to transfer to bonding curve. Please try again.");
        // Still save to DB but with a flag or warning
      }

      // Save token to database with pump.fun style bonding curve
      // Initial: 25 SOL virtual reserves, 950M tokens = $5k market cap at $200/SOL
      const initialSolReserves = 25_000_000_000; // 25 SOL in lamports
      const initialTokenReserves = 950_000_000_000_000_000; // 950M tokens with 9 decimals (95%)
      
      // For remix tokens, fetch original token's creator wallet for royalties
      let royaltyRecipient: string | null = null;
      if (isRemix && originalTokenId) {
        try {
          const { data: originalToken } = await supabase
            .from("tokens")
            .select("creator_wallet")
            .eq("id", originalTokenId)
            .single();
          if (originalToken) {
            royaltyRecipient = originalToken.creator_wallet;
          }
        } catch (e) {
          console.error("Error fetching original token:", e);
        }
      }
      
      // Get the audio URL from upload result or preloaded URL
      const finalAudioUrl = uploadResult.audioUrl || preloadedAudioUrl || null;
      
      try {
        await supabase.from("tokens").insert({
          mint_address: mintAddr,
          name: name.slice(0, 32),
          symbol: symbol.slice(0, 10),
          creator_wallet: walletAddress,
          initial_price: 1, // Starting price is very low
          total_supply: 1_000_000_000,
          metadata_uri: metadataUri,
          audio_clip_id: preloadedClipId || null,
          audio_url: finalAudioUrl,
          sol_reserves: initialSolReserves,
          token_reserves: initialTokenReserves,
          tokens_sold: 0,
          total_volume: 0,
          is_active: true,
          is_remix: isRemix,
          original_token_id: isRemix ? originalTokenId : null,
          royalty_recipient: royaltyRecipient,
          royalty_percentage: isRemix ? 10 : 0, // 10% royalty to original creator
        } as any);
        
        if (isRemix) {
          toast.success("Remix token created! Original creator earns 10% on trades.");
        }
      } catch (dbError) {
        console.error("Error saving token to database:", dbError);
      }

      // Update mint_token task progress
      const taskCompleted = await updateTaskProgress(walletAddress, "mint_token", 1);
      if (taskCompleted) {
        toast.success("Quest completed: Mint 1 token! 🎉");
      }

      setMintAddress(mintAddr);
      setSuccess(true);
      toast.success("Token created successfully!");
    } catch (error: any) {
      console.error("Error creating token:", error);
      // Show the raw error message for debugging
      const errorMessage = error?.message || error?.toString() || "Unknown error occurred";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setUploadingIPFS(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl md:text-5xl font-bold text-primary">
                {isRemix ? "Create Remix Token" : "Create Your Audio Token"}
              </h1>
              {isRemix && (
                <p className="mt-2 text-muted-foreground">
                  Creating a remix of an existing token. Original creator earns 10% royalty on all trades.
                </p>
              )}
            </div>

            {/* Wallet Connection Warning */}
            {!connected && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <p className="text-foreground">
                  Please connect your wallet to create tokens.
                </p>
              </div>
            )}

            <div className="space-y-6">
              {/* Route Selection */}
              <div className="bg-card rounded-2xl shadow-noiz-lg p-6">
                <h2 className="text-2xl font-bold mb-4 text-foreground font-display">
                  Choose Creation Method
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bonding Curve Option - RECOMMENDED */}
                  <button
                    onClick={() => setRoute("bonding-curve")}
                    className={`relative p-6 rounded-xl border-2 transition-all text-left ${
                      route === "bonding-curve"
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    {/* Recommended Badge */}
                    <div className="absolute -top-3 left-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                        <Shield className="w-3 h-3" />
                        RECOMMENDED
                      </span>
                    </div>

                    <div className="flex items-start justify-between mb-3 mt-2">
                      <div className="text-3xl">📈</div>
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          route === "bonding-curve"
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        }`}
                      >
                        {route === "bonding-curve" && (
                          <Check className="w-4 h-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-foreground">
                      Bonding Curve
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Transparent, algorithmic pricing with locked liquidity. The safest way to launch.
                    </p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-primary">
                        <Shield className="w-3.5 h-3.5" />
                        <span className="font-semibold">Rug-proof: Liquidity locked in curve</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>✅</span>
                        <span>Fair launch - everyone buys at same curve</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>✅</span>
                        <span>No upfront liquidity needed</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>✅</span>
                        <span>Instant trading on NoizLabs</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-bold text-primary">0.02 SOL</span>
                        <span className="text-sm text-muted-foreground ml-2">({formatUsd(0.02)})</span>
                      </div>
                    </div>
                  </button>

                  {/* Manual LP Option - WITH WARNING */}
                  <button
                    onClick={() => setRoute("manual-lp")}
                    className={`relative p-6 rounded-xl border-2 transition-all text-left ${
                      route === "manual-lp"
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-accent/30 opacity-80"
                    }`}
                  >
                    {/* Warning Badge */}
                    <div className="absolute -top-3 left-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        ADVANCED
                      </span>
                    </div>

                    <div className="flex items-start justify-between mb-3 mt-2">
                      <div className="text-3xl">🔧</div>
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          route === "manual-lp"
                            ? "border-accent bg-accent"
                            : "border-muted-foreground"
                        }`}
                      >
                        {route === "manual-lp" && (
                          <Check className="w-4 h-4 text-accent-foreground" />
                        )}
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-foreground">
                      Manual Liquidity
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Full control. Add liquidity on Raydium/Orca yourself.
                    </p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-destructive/80">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="font-medium">Requires manual LP setup</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>⚠️</span>
                        <span>Higher risk if LP not locked</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>✅</span>
                        <span>Mint to your wallet</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>✅</span>
                        <span>Trade on external DEXs</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-bold text-accent">{route === "manual-lp" ? calculateCost() : 0.5} SOL</span>
                        <span className="text-sm text-muted-foreground ml-2">({formatUsd(route === "manual-lp" ? calculateCost() : 0.5)})</span>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Manual LP Options */}
                {route === "manual-lp" && (
                  <div className="mt-6 p-4 bg-accent/10 rounded-lg">
                    <h4 className="font-bold mb-3 text-foreground">
                      Additional Options (+0.1 SOL each)
                    </h4>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={disableMinting}
                          onChange={(e) => setDisableMinting(e.target.checked)}
                          className="w-5 h-5 accent-accent"
                        />
                        <span className="text-foreground">
                          Disable Minting - No more tokens can be created
                        </span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={disableFreezing}
                          onChange={(e) => setDisableFreezing(e.target.checked)}
                          className="w-5 h-5 accent-accent"
                        />
                        <span className="text-foreground">
                          Disable Freezing - Tokens can't be frozen
                        </span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={makeImmutable}
                          onChange={(e) => setMakeImmutable(e.target.checked)}
                          className="w-5 h-5 accent-accent"
                        />
                        <span className="text-foreground">
                          Make Immutable - Metadata can't be changed
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Token Details Form */}
              <div className="bg-card rounded-2xl shadow-noiz-lg p-6">
                <h2 className="text-2xl font-bold mb-4 text-foreground font-display">
                  Token Details
                </h2>

                <div className="space-y-4">
                  <div>
                    <Label className="text-foreground">
                      Token Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="Bruh Sound Effect"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={32}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label className="text-foreground">
                      Token Symbol <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="BRUH"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      maxLength={10}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label className="text-foreground">Description</Label>
                    <Textarea
                      placeholder="The legendary bruh moment sound that went viral..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label className="text-foreground">
                      Audio File <span className="text-destructive">*</span>
                    </Label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioChange}
                      ref={audioInputRef}
                      className="hidden"
                    />
                    <div
                      onClick={() => audioInputRef.current?.click()}
                      className={`mt-2 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                        preloadedAudioUrl || audioFile 
                          ? "border-primary/50 bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Music className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      {preloadedAudioUrl ? (
                        <p className="text-primary font-semibold">
                          ✅ Audio loaded from Discover
                        </p>
                      ) : audioFile ? (
                        <p className="text-primary font-semibold">
                          ✅ {audioFile.name}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          Click to upload audio file
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Audio preview */}
                  {(preloadedAudioUrl || audioFile) && (
                    <div className="bg-muted p-4 rounded-lg">
                      <audio controls className="w-full">
                        <source
                          src={preloadedAudioUrl || (audioFile ? URL.createObjectURL(audioFile) : "")}
                          type={audioFile?.type || "audio/mpeg"}
                        />
                      </audio>
                      {preloadedAudioUrl && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Audio loaded from Discover page
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <Label className="text-foreground">Cover Image (Optional)</Label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      ref={imageInputRef}
                      className="hidden"
                    />
                    
                    {/* Show preloaded cover image from Discover */}
                    {preloadedCoverImageUrl && !imageFile && (
                      <div className="mt-2 border-2 border-primary/50 bg-primary/5 rounded-xl p-4">
                        <p className="text-primary font-semibold text-sm mb-2">
                          ✅ Cover image loaded from Discover
                        </p>
                        <img
                          src={preloadedCoverImageUrl}
                          alt="Preloaded cover"
                          className="w-32 h-32 object-cover rounded-lg mx-auto"
                        />
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Click below to upload a different image
                        </p>
                      </div>
                    )}
                    
                    <div
                      onClick={() => imageInputRef.current?.click()}
                      className="mt-2 border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      {imageFile ? (
                        <div>
                          <p className="text-primary font-semibold mb-2">
                            ✅ {imageFile.name}
                          </p>
                          <img
                            src={URL.createObjectURL(imageFile)}
                            alt="Preview"
                            className="w-32 h-32 object-cover rounded-lg mx-auto"
                          />
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          {preloadedCoverImageUrl ? "Click to upload a different image" : "Click to upload cover image"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Summary */}
              <div className="bg-primary rounded-xl p-6 text-primary-foreground">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Cost:</span>
                  <div className="text-right">
                    <span className="text-3xl font-bold block">
                      {calculateCost()} SOL
                    </span>
                    <span className="text-sm text-primary-foreground/80">
                      ≈ {formatUsd(calculateCost())}
                    </span>
                  </div>
                </div>
              </div>

              {/* Create Button */}
              <Button
                onClick={handleMint}
                disabled={loading || !name || !symbol || (!audioFile && !preloadedAudioUrl) || !connected}
                size="lg"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {uploadingIPFS ? "Uploading to IPFS..." : "Creating Token..."}
                  </>
                ) : !connected ? (
                  "Connect Wallet First"
                ) : (
                  "🚀 Create Token"
                )}
              </Button>

              {/* Success Message */}
              {success && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-6">
                  <h3 className="text-2xl font-bold text-primary mb-4">
                    ✅ Token Created Successfully!
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-foreground font-semibold mb-1">
                        Mint Address:
                      </p>
                      <Input
                        type="text"
                        value={mintAddress}
                        readOnly
                        onClick={(e) => {
                          e.currentTarget.select();
                          navigator.clipboard.writeText(mintAddress);
                          toast.success("Copied!");
                        }}
                        className="font-mono text-xs cursor-pointer"
                      />
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <a
                        href={`https://explorer.solana.com/address/${mintAddress}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors"
                      >
                        🔍 View on Solana Explorer
                      </a>
                      <a
                        href={`/trade?mint=${mintAddress}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/80 rounded-lg text-sm font-medium transition-colors"
                      >
                        📈 Trade Now
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
};

export default CreatePage;