import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import { 
  TrendingUp, 
  Users, 
  Coins, 
  Music, 
  Wallet, 
  BarChart3, 
  Gem, 
  DollarSign,
  ArrowLeft,
  Loader2,
  Banknote
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAnalytics, TimeRange } from "@/hooks/useAnalytics";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const formatNumber = (num: number): string => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
};

const formatSOL = (lamports: number): string => {
  const sol = lamports / 1e9;
  if (sol >= 1e6) return `${(sol / 1e6).toFixed(2)}M SOL`;
  if (sol >= 1e3) return `${(sol / 1e3).toFixed(2)}K SOL`;
  return `${sol.toFixed(4)} SOL`;
};

const Analytics = () => {
  const { publicKey } = useWallet();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const { data, timeSeries, loading } = useAnalytics(timeRange);

  const stats = [
    {
      title: "Daily Active Users",
      value: formatNumber(data.dailyActiveUsers),
      icon: Users,
      description: "Unique wallets active",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Tokens Launched",
      value: formatNumber(data.tokensLaunched),
      icon: Coins,
      description: "Total tokens created",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Remixed Tokens",
      value: formatNumber(data.remixedTokens),
      icon: Gem,
      description: "Derivative tokens",
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
    {
      title: "Clips Uploaded",
      value: formatNumber(data.clipsUploaded),
      icon: Music,
      description: "Audio clips submitted",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Connected Wallets",
      value: formatNumber(data.connectedWallets),
      icon: Wallet,
      description: "Unique wallets connected",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Total Volume",
      value: formatSOL(data.totalVolume),
      icon: BarChart3,
      description: "Trading volume",
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      title: "Minted Tokens",
      value: formatNumber(data.mintedTokens),
      icon: TrendingUp,
      description: "On-chain tokens",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Platform Revenue",
      value: formatSOL(data.revenue),
      icon: DollarSign,
      description: "Platform fees (1%)",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Creator Fees",
      value: formatSOL(data.totalCreatorFees),
      icon: Banknote,
      description: "Total paid to creators",
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
    },
  ];

  const chartConfig = {
    value: {
      label: "Value",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Platform Analytics</h1>
              <p className="text-muted-foreground">
                Real-time insights into NoizLabs platform activity
              </p>
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <Tabs 
          value={timeRange} 
          onValueChange={(v) => setTimeRange(v as TimeRange)} 
          className="mb-8"
        >
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="24h">24 Hours</TabsTrigger>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {stats.map((stat) => (
                <Card key={stat.title} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardDescription>{stat.title}</CardDescription>
                      <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Users Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Active Users Over Time</CardTitle>
                  <CardDescription>Unique wallets trading per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeSeries.users}>
                        <defs>
                          <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="date" 
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis 
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => formatNumber(value)}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          fill="url(#usersGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Volume Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Trading Volume</CardTitle>
                  <CardDescription>Daily trading volume in SOL</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeSeries.volume}>
                        <XAxis 
                          dataKey="date" 
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis 
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `${value.toFixed(2)}`}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar
                          dataKey="value"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Tokens Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tokens Launched</CardTitle>
                  <CardDescription>New tokens created per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeSeries.tokens}>
                        <defs>
                          <linearGradient id="tokensGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(280 70% 50%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(280 70% 50%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="date" 
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis 
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(280 70% 50%)"
                          fill="url(#tokensGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Clips Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Clips Uploaded</CardTitle>
                  <CardDescription>Audio clips submitted per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeSeries.clips}>
                        <XAxis 
                          dataKey="date" 
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis 
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar
                          dataKey="value"
                          fill="hsl(142 70% 45%)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;
