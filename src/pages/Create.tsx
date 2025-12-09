import { useState, useRef, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction } from "@solana/web3.js";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Music, Image, Check, Loader2, AlertCircle, Settings } from "lucide-react";
import { createAudioTokenWithCurve, CreateAudioTokenParams } from "@/lib/solana/program";
import { uploadTokenMetadata } from "@/lib/pinata";
import { useSolPrice } from "@/hooks/useSolPrice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type TokenCreationRoute = "bonding-curve" | "manual-lp";

// Store Pinata keys in localStorage for convenience (user can configure)
const PINATA_API_KEY_STORAGE = "noizlabs_pinata_api_key";
const PINATA_SECRET_STORAGE = "noizlabs_pinata_secret";

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
  
  // Pinata configuration
  const [pinataApiKey, setPinataApiKey] = useState(() => 
    localStorage.getItem(PINATA_API_KEY_STORAGE) || ""
  );
  const [pinataSecret, setPinataSecret] = useState(() => 
    localStorage.getItem(PINATA_SECRET_STORAGE) || ""
  );
  const [showPinataConfig, setShowPinataConfig] = useState(false);

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
        // Generate symbol from title
        if (audioData.title) {
          const generatedSymbol = audioData.title
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 6);
          setSymbol(generatedSymbol || "TOKEN");
        }
        // Clear after loading
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

  const savePinataConfig = () => {
    localStorage.setItem(PINATA_API_KEY_STORAGE, pinataApiKey);
    localStorage.setItem(PINATA_SECRET_STORAGE, pinataSecret);
    setShowPinataConfig(false);
    toast.success("Pinata configuration saved!");
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

  const isPinataConfigured = pinataApiKey && pinataSecret;

  const handleMint = async () => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first!");
      return;
    }

    if (!name || !symbol || !audioFile) {
      toast.error("Please fill all required fields!");
      return;
    }

    if (!isPinataConfigured) {
      toast.error("Please configure Pinata API keys first!");
      setShowPinataConfig(true);
      return;
    }

    setLoading(true);
    setUploadingIPFS(true);

    try {
      // Upload files to Pinata IPFS
      toast.info("Uploading files to IPFS...");
      const uploadResult = await uploadTokenMetadata(
        audioFile,
        imageFile,
        { name, symbol, description },
        pinataApiKey,
        pinataSecret
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Failed to upload to IPFS");
      }

      setUploadingIPFS(false);
      toast.success("Files uploaded to IPFS!");
      
      // The metadataUri contains all the info (including audio URL inside it)
      const metadataUri = uploadResult.url!;

      // Generate a new mint keypair
      const mintKeypair = Keypair.generate();

      // Create the instruction - matching Anchor's create_audio_token_with_curve
      const params: CreateAudioTokenParams = {
        name: name.slice(0, 50), // Max 50 chars
        symbol: symbol.slice(0, 10), // Max 10 chars
        metadataUri: metadataUri.slice(0, 200), // Max 200 chars
        totalSupply: BigInt(1_000_000_000 * 1e9), // 1 billion tokens with 9 decimals
        initialPrice: BigInt(10_000), // 0.00001 SOL initial price
      };

      console.log("Creating token with params:", {
        name: params.name,
        symbol: params.symbol,
        metadataUri: params.metadataUri,
        totalSupply: params.totalSupply.toString(),
        initialPrice: params.initialPrice.toString(),
        mint: mintKeypair.publicKey.toString(),
        creator: publicKey.toString(),
      });

      const transaction = await createAudioTokenWithCurve(
        connection,
        publicKey,
        mintKeypair,
        params
      );
      
      console.log("Transaction created with Anchor SDK");

      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      setMintAddress(mintKeypair.publicKey.toString());
      setSuccess(true);
      toast.success("Token created successfully!");
    } catch (error: any) {
      console.error("Error creating token:", error);
      toast.error(error.message || "Failed to create token");
    } finally {
      setLoading(false);
      setUploadingIPFS(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <h1 className="text-4xl md:text-5xl font-bold text-primary">
                Create Your Audio Token
              </h1>
              
              {/* Pinata Configuration Button */}
              <Dialog open={showPinataConfig} onOpenChange={setShowPinataConfig}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    {isPinataConfigured ? "IPFS ✓" : "Configure IPFS"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Pinata IPFS Configuration</DialogTitle>
                    <DialogDescription>
                      Enter your Pinata API keys to enable IPFS uploads. Get free keys at{" "}
                      <a href="https://pinata.cloud" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        pinata.cloud
                      </a>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Pinata API Key</Label>
                      <Input
                        type="text"
                        placeholder="Enter your API key"
                        value={pinataApiKey}
                        onChange={(e) => setPinataApiKey(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Pinata Secret Key</Label>
                      <Input
                        type="password"
                        placeholder="Enter your secret key"
                        value={pinataSecret}
                        onChange={(e) => setPinataSecret(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <Button onClick={savePinataConfig} className="w-full">
                      Save Configuration
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
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
            
            {/* Pinata Warning */}
            {!isPinataConfigured && (
              <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-xl flex items-center gap-3">
                <Settings className="w-5 h-5 text-accent flex-shrink-0" />
                <p className="text-foreground">
                  Configure Pinata IPFS to upload your audio files. Click "Configure IPFS" above.
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
                  {/* Bonding Curve Option */}
                  <button
                    onClick={() => setRoute("bonding-curve")}
                    className={`p-6 rounded-xl border-2 transition-all text-left ${
                      route === "bonding-curve"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
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
                      Automatic price discovery. Instant liquidity. Users trade on your platform.
                    </p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>✅</span>
                        <span>No liquidity needed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>✅</span>
                        <span>Fair launch (no rug)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>✅</span>
                        <span>Earn platform fees</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border">
                      <span className="text-xl font-bold text-primary">0.02 SOL</span>
                      <span className="text-sm text-muted-foreground ml-2">({formatUsd(0.02)})</span>
                    </div>
                  </button>

                  {/* Manual LP Option */}
                  <button
                    onClick={() => setRoute("manual-lp")}
                    className={`p-6 rounded-xl border-2 transition-all text-left ${
                      route === "manual-lp"
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-accent/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
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
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>✅</span>
                        <span>Mint to your wallet</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>✅</span>
                        <span>Full control over LP</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>✅</span>
                        <span>Optional immutability</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border">
                      <span className="text-xl font-bold text-accent">{calculateCost()} SOL</span>
                      <span className="text-sm text-muted-foreground ml-2">({formatUsd(calculateCost())})</span>
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
                      maxLength={50}
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

                  {/* Audio preview - preloaded or uploaded */}
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
                    <div
                      onClick={() => imageInputRef.current?.click()}
                      className="mt-2 border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      {imageFile ? (
                        <div>
                          <p className="text-noiz-green font-semibold mb-2">
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
                          Click to upload cover image
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
                disabled={loading || !name || !symbol || (!audioFile && !preloadedAudioUrl) || !connected || !isPinataConfigured}
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
                ) : !isPinataConfigured ? (
                  "Configure IPFS First"
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
                    <p className="text-center font-bold text-foreground">
                      👉 Copy this and paste in "Trade Token" tab!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CreatePage;
