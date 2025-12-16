import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TokensTab from "@/components/explore/TokensTab";
import ClipsTab from "@/components/explore/ClipsTab";

const ExplorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "tokens";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-foreground">Explore</h1>
            <p className="text-muted-foreground text-sm">
              Discover audio tokens and clips on NoizLabs
            </p>
          </div>

          <Tabs defaultValue={defaultTab} onValueChange={handleTabChange}>
            <TabsList className="mb-4">
              <TabsTrigger value="tokens">🎵 Tokens</TabsTrigger>
              <TabsTrigger value="clips">🎧 Clips</TabsTrigger>
            </TabsList>

            <TabsContent value="tokens">
              <TokensTab />
            </TabsContent>

            <TabsContent value="clips">
              <ClipsTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ExplorePage;
