import { useState } from "react";
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
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import { useUserAnalytics } from "@/hooks/useUserAnalytics";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useSolPrice } from "@/hooks/useSolPrice";
import { CreatorEarningsCard, TokenEarningsData } from "@/components/CreatorEarningsCard";
import { format } from "date-fns";

const formatSOL = (lamports: number): string => {
  const sol = lamports / 1e9;
  if (sol >= 1e6) return `${(sol / 1e6).toFixed(2)}M`;
  if (sol >= 1e3) return `${(sol / 1e3).toFixed(2)}K`;
  return sol.toFixed(4);
};

const formatSOLShort = (lamports: number): string => {
  const sol = lamports / 1e9;
  if (sol >= 1e6) return `${(sol / 1e6).toFixed(1)}M`;
  if (sol >= 1e3) return `${(sol / 1e3).toFixed(1)}K`;
  if (sol === 0) return "0";
  return sol.toFixed(2);
};

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  amber: "#f59e0b",
  cyan: "#06b6d4",
};

const UserAnalytics = () => {
  const { publicKey, connected } = useWallet();
  const navigate = useNavigate();
  const walletAddress = publicKey?.toBase58() || null;
  const { data, loading } = useUserAnalytics(walletAddress);
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();
  const { price: solPrice } = useSolPrice();
  const [trendPeriod, setTrendPeriod] = useState<"weekly" | "monthly">("weekly");
  const [selectedTokenForCard, setSelectedTokenForCard] = useState<string | null>(null);

  // Check if feature is enabled
  if (!flagsLoading && !isEnabled("user_analytics")) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 pt-20 container max-w-4xl mx-auto px-4 py-8 flex items-center justify-center">
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
        <main className="flex-1 pt-20 container max-w-4xl mx-auto px-4 py-8 flex items-center justify-center">
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

  const trendData = trendPeriod === "weekly" ? data.weeklyTrends : data.monthlyTrends;
  
  const pieData = [
    { name: "Buys", value: data.tradesByType.buys, color: CHART_COLORS.green },
    { name: "Sells", value: data.tradesByType.sells, color: CHART_COLORS.purple },
  ];

  const chartData = trendData.map(d => ({
    ...d,
    volumeSOL: d.volume / 1e9,
    earningsSOL: d.earnings / 1e9,
  }));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-20 container max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-8">
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
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {stats.map((stat) => (
                <Card key={stat.title} className="overflow-hidden">
                  <CardHeader className="pb-2 p-3 md:p-4 md:pb-2">
                    <div className="flex items-center justify-between">
                      <CardDescription className="text-xs">{stat.title}</CardDescription>
                      <div className={`p-1.5 rounded-lg ${stat.bgColor}`}>
                        <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 md:p-4 md:pt-0">
                    <div className="text-lg md:text-2xl font-bold truncate">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trading Volume Chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">Trading Volume</CardTitle>
                      <CardDescription>Your trading activity over time</CardDescription>
                    </div>
                    <Tabs value={trendPeriod} onValueChange={(v) => setTrendPeriod(v as "weekly" | "monthly")}>
                      <TabsList className="h-8">
                        <TabsTrigger value="weekly" className="text-xs px-3">Weekly</TabsTrigger>
                        <TabsTrigger value="monthly" className="text-xs px-3">Monthly</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] md:h-[300px]">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={CHART_COLORS.cyan} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={CHART_COLORS.cyan} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis 
                            dataKey="label" 
                            tick={{ fontSize: 12 }} 
                            tickLine={false}
                            axisLine={false}
                            className="fill-muted-foreground"
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }} 
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `${v}`}
                            className="fill-muted-foreground"
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                            formatter={(value: number) => [`${value.toFixed(4)} SOL`, "Volume"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="volumeSOL"
                            stroke={CHART_COLORS.cyan}
                            strokeWidth={2}
                            fill="url(#volumeGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        No trading data yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Trade Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Trade Distribution</CardTitle>
                  <CardDescription>Buy vs Sell breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    {data.tradesByType.buys > 0 || data.tradesByType.sells > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        No trades yet
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center gap-6 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm">Buys: {data.tradesByType.buys}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-sm">Sells: {data.tradesByType.sells}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Earnings Chart */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-amber-500" />
                  <div>
                    <CardTitle className="text-lg">Creator Earnings</CardTitle>
                    <CardDescription>Fees earned from your tokens over time</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  {chartData.some(d => d.earningsSOL > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fontSize: 12 }} 
                          tickLine={false}
                          axisLine={false}
                          className="fill-muted-foreground"
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }} 
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${v}`}
                          className="fill-muted-foreground"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`${value.toFixed(4)} SOL`, "Earnings"]}
                        />
                        <Bar dataKey="earningsSOL" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No earnings data yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Creator Earnings Download Section */}
            {data.tokens.length > 0 && data.totalCreatorFees > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-green-500" />
                    <div>
                      <CardTitle className="text-lg">Download Earnings Certificate</CardTitle>
                      <CardDescription>Select a token to generate your shareable earnings report</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Token Selector */}
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Select a token:</p>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {data.tokens.filter(t => t.creatorFees > 0).map((token) => (
                          <button
                            key={token.id}
                            onClick={() => setSelectedTokenForCard(token.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              selectedTokenForCard === token.id 
                                ? 'border-primary bg-primary/10' 
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            }`}
                          >
                            {token.coverImage ? (
                              <img src={token.coverImage} alt={token.name} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Coins className="w-5 h-5 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 text-left min-w-0">
                              <p className="font-medium truncate">{token.name}</p>
                              <p className="text-xs text-muted-foreground">${token.symbol}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-green-500">
                                {formatSOL(token.creatorFees)} SOL
                              </p>
                              <p className="text-xs text-muted-foreground">earned</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Earnings Card Preview */}
                    <div>
                      {selectedTokenForCard ? (
                        (() => {
                          const token = data.tokens.find(t => t.id === selectedTokenForCard);
                          if (!token) return null;
                          
                          const tokenEarningsData: TokenEarningsData = {
                            tokenName: token.name,
                            tokenSymbol: token.symbol,
                            currentMarketCap: (token.solReserves / 1e9) * 2, // Market cap = solReserves * 2 (in SOL)
                            allTimeMarketCap: Math.max((token.solReserves / 1e9) * 2, token.volume / 1e9 * 0.1), // ATH estimate
                            totalVolume: token.volume / 1e9,
                            creatorFeesEarned: token.creatorFees / 1e9,
                            walletAddress: walletAddress || "",
                          };
                          
                          return (
                            <CreatorEarningsCard 
                              tokenData={tokenEarningsData} 
                              solPrice={solPrice || 200} 
                            />
                          );
                        })()
                      ) : (
                        <div className="h-full min-h-[300px] flex items-center justify-center border border-dashed border-border rounded-lg">
                          <div className="text-center text-muted-foreground">
                            <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Select a token to preview</p>
                            <p className="text-sm">your earnings certificate</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Token Performance Table */}
              {data.tokens.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Token Performance</CardTitle>
                    </div>
                    <CardDescription>
                      Volume and earnings per token
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 md:p-6 md:pt-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Token</TableHead>
                            <TableHead className="text-right">Volume</TableHead>
                            <TableHead className="text-right">Trades</TableHead>
                            <TableHead className="text-right">Fees</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.tokens.slice(0, 5).map((token) => (
                            <TableRow key={token.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
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
                                  <div className="min-w-0">
                                    <div className="font-medium truncate text-sm">{token.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      ${token.symbol}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatSOLShort(token.volume)}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {token.tradesCount}
                              </TableCell>
                              <TableCell className="text-right text-green-500 text-sm font-medium">
                                {formatSOLShort(token.creatorFees)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                  </div>
                  <CardDescription>Your latest actions</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {data.recentActivity.slice(0, 6).map((activity) => (
                        <div key={activity.id} className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            activity.type === 'trade' 
                              ? 'bg-blue-500/10' 
                              : activity.type === 'clip' 
                                ? 'bg-green-500/10' 
                                : 'bg-purple-500/10'
                          }`}>
                            {activity.type === 'trade' ? (
                              <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                            ) : activity.type === 'clip' ? (
                              <Music className="w-4 h-4 text-green-500" />
                            ) : (
                              <Coins className="w-4 h-4 text-purple-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{activity.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            {activity.amount && (
                              <p className="text-sm font-medium">{formatSOLShort(activity.amount)} SOL</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(activity.timestamp), 'MMM d')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No activity yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Empty State */}
            {data.tokens.length === 0 && data.clipsUploaded === 0 && data.totalTrades === 0 && (
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
          </div>
        )}
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
};

export default UserAnalytics;
