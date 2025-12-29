import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Music,
  Coins,
  TrendingUp,
  DollarSign,
  ArrowLeftRight,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import { useUserAnalytics } from "@/hooks/useUserAnalytics";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const formatSOL = (lamports: number): string => {
  const sol = lamports / 1e9;
  if (sol >= 1e6) return `${(sol / 1e6).toFixed(2)}M`;
  if (sol >= 1e3) return `${(sol / 1e3).toFixed(2)}K`;
  return sol.toFixed(4);
};

const UserAnalytics = () => {
  const { publicKey, connected } = useWallet();
  const navigate = useNavigate();
  const walletAddress = publicKey?.toBase58() || null;
  const { data, loading } = useUserAnalytics(walletAddress);
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();

  // Check if feature is enabled
  if (!flagsLoading && !isEnabled("user_analytics")) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 container max-w-4xl mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
              <CardDescription>
                User analytics will be available soon. Stay tuned!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate(-1)}>Go Back</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
        <MobileTabBar />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 container max-w-4xl mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle>Connect Wallet</CardTitle>
              <CardDescription>
                Connect your wallet to view your personal analytics
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
        <Footer />
        <MobileTabBar />
      </div>
    );
  }

  const stats = [
    {
      title: "Clips Uploaded",
      value: data.clipsUploaded,
      icon: Music,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Tokens Created",
      value: data.tokensCreated,
      icon: Coins,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Total Trades",
      value: data.totalTrades,
      icon: ArrowLeftRight,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Trading Volume",
      value: `${formatSOL(data.totalVolume)} SOL`,
      icon: TrendingUp,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      title: "Creator Fees Earned",
      value: `${formatSOL(data.totalCreatorFees)} SOL`,
      icon: DollarSign,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">My Analytics</h1>
            <p className="text-muted-foreground text-sm">
              Your personal activity and earnings overview
            </p>
          </div>
        </div>

        {loading || flagsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {stats.map((stat) => (
                <Card key={stat.title} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardDescription className="text-xs">{stat.title}</CardDescription>
                      <div className={`p-1.5 rounded-lg ${stat.bgColor}`}>
                        <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Token Analytics Table */}
            {data.tokens.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <CardTitle>Token Performance</CardTitle>
                  </div>
                  <CardDescription>
                    Volume and earnings per token you created
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token</TableHead>
                        <TableHead className="text-right">Volume (SOL)</TableHead>
                        <TableHead className="text-right">Trades</TableHead>
                        <TableHead className="text-right">Creator Fees (SOL)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.tokens.map((token) => (
                        <TableRow key={token.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {token.coverImage ? (
                                <img
                                  src={token.coverImage}
                                  alt={token.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Coins className="w-4 h-4 text-primary" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium">{token.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  ${token.symbol}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatSOL(token.volume)}
                          </TableCell>
                          <TableCell className="text-right">
                            {token.tradesCount}
                          </TableCell>
                          <TableCell className="text-right text-green-500 font-medium">
                            {formatSOL(token.creatorFees)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {data.tokens.length === 0 && data.clipsUploaded === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <Music className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start by uploading clips or creating tokens to see your analytics
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => navigate("/create")}>Create Token</Button>
                    <Button variant="outline" onClick={() => navigate("/explore")}>
                      Explore
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
};

export default UserAnalytics;
