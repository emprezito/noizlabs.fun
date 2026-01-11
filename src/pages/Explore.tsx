import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import TokensTab from "@/components/explore/TokensTab";
import ClipsTab from "@/components/explore/ClipsTab";

const ExplorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const defaultTab = searchParams.get("tab") || "tokens";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Explore</h1>
          <p className="text-muted-foreground text-sm">
            Discover audio tokens and clips on NoizLabs
          </p>
        </div>

          <Tabs defaultValue={defaultTab} onValueChange={handleTabChange}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="tokens">🎵 Tokens</TabsTrigger>
                <TabsTrigger value="clips">🎧 Clips</TabsTrigger>
              </TabsList>
              {defaultTab === "clips" && (
                <Button size="sm" onClick={() => setShowUploadModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Upload</span>
                </Button>
              )}
            </div>

            <TabsContent value="tokens">
              <TokensTab />
            </TabsContent>

            <TabsContent value="clips">
              <ClipsTab 
                showUploadModal={showUploadModal} 
                setShowUploadModal={setShowUploadModal} 
              />
            </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </AppLayout>
  );
};

export default ExplorePage;
