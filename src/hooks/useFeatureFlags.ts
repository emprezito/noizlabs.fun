import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FeatureFlag {
  id: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
}

let flagsCache: Record<string, boolean> = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<Record<string, boolean>>(flagsCache);
  const [loading, setLoading] = useState(Object.keys(flagsCache).length === 0);

  useEffect(() => {
    const fetchFlags = async () => {
      const now = Date.now();
      
      // Return cached data if still valid
      if (Object.keys(flagsCache).length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
        setFlags(flagsCache);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("feature_flags")
        .select("*");

      if (error) {
        console.error("Error fetching feature flags:", error);
        setLoading(false);
        return;
      }

      const newFlags: Record<string, boolean> = {};
      (data as FeatureFlag[]).forEach((flag) => {
        newFlags[flag.feature_key] = flag.is_enabled;
      });

      flagsCache = newFlags;
      cacheTimestamp = now;
      setFlags(newFlags);
      setLoading(false);
    };

    fetchFlags();
  }, []);

  const isEnabled = (featureKey: string): boolean => {
    return flags[featureKey] ?? false;
  };

  return { flags, loading, isEnabled };
};

// Utility function to check a single flag
export const checkFeatureFlag = async (featureKey: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("is_enabled")
    .eq("feature_key", featureKey)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return data.is_enabled;
};
