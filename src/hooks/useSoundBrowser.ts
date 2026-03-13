import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = "https://myinstants-api.vercel.app";

export interface MyInstantSound {
  id: string;
  title: string;
  mp3_url: string;
  description?: string;
  tags?: string[];
  views?: number;
  favorites?: number;
}

export interface SoundRegistryEntry {
  id: string;
  sound_id: string;
  audio_hash: string | null;
  audio_url: string;
  token_name: string | null;
  token_ticker: string | null;
  token_address: string | null;
  minted_by: string | null;
  minted_at: string | null;
  status: "available" | "reserved" | "minted";
  reserved_by: string | null;
  reserved_at: string | null;
  reservation_expires_at: string | null;
}

export type SoundMintStatus = "available" | "reserved" | "minted";

export interface SoundWithStatus extends MyInstantSound {
  mintStatus: SoundMintStatus;
  registryEntry?: SoundRegistryEntry;
}

async function fetchTrending(): Promise<MyInstantSound[]> {
  const res = await fetch(`${API_BASE}/trending?q=us`);
  if (!res.ok) throw new Error("Failed to fetch trending sounds");
  return res.json();
}

async function searchSounds(query: string): Promise<MyInstantSound[]> {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to search sounds");
  return res.json();
}

export function useSoundBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"trending" | "search">("trending");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const queryClient = useQueryClient();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        setDebouncedQuery(searchQuery.trim());
        setActiveTab("search");
      } else {
        setActiveTab("trending");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch trending sounds (cached 5 min)
  const trendingQuery = useQuery({
    queryKey: ["sounds", "trending"],
    queryFn: fetchTrending,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Search sounds
  const searchResultsQuery = useQuery({
    queryKey: ["sounds", "search", debouncedQuery],
    queryFn: () => searchSounds(debouncedQuery),
    enabled: !!debouncedQuery && activeTab === "search",
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  const sounds = activeTab === "trending" 
    ? trendingQuery.data 
    : searchResultsQuery.data;

  const isLoading = activeTab === "trending" 
    ? trendingQuery.isLoading 
    : searchResultsQuery.isLoading;

  const error = activeTab === "trending" 
    ? trendingQuery.error 
    : searchResultsQuery.error;

  // Check registry status for visible sounds
  const soundIds = sounds?.map(s => s.id) || [];
  const registryQuery = useQuery({
    queryKey: ["sounds-registry", soundIds],
    queryFn: async () => {
      if (!soundIds.length) return [];
      const { data } = await supabase.functions.invoke("sounds-registry", {
        body: { action: "check_sounds", soundIds },
      });
      return (data?.registry || []) as SoundRegistryEntry[];
    },
    enabled: soundIds.length > 0,
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  // Merge sounds with registry status
  const soundsWithStatus: SoundWithStatus[] = (sounds || []).map(sound => {
    const entry = registryQuery.data?.find(r => r.sound_id === sound.id);
    let mintStatus: SoundMintStatus = "available";
    if (entry) {
      if (entry.status === "minted") mintStatus = "minted";
      else if (entry.status === "reserved") {
        // Check if reservation is expired
        if (entry.reservation_expires_at && new Date(entry.reservation_expires_at) < new Date()) {
          mintStatus = "available";
        } else {
          mintStatus = "reserved";
        }
      }
    }
    return { ...sound, mintStatus, registryEntry: entry };
  });

  const refetchRegistry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sounds-registry"] });
  }, [queryClient]);

  const retry = useCallback(() => {
    if (activeTab === "trending") {
      trendingQuery.refetch();
    } else {
      searchResultsQuery.refetch();
    }
  }, [activeTab, trendingQuery, searchResultsQuery]);

  return {
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    sounds: soundsWithStatus,
    isLoading,
    error,
    retry,
    refetchRegistry,
  };
}

// Audio player hook - only one at a time
export function useSoundPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const play = useCallback((id: string, url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingId === id) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(url);
    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.play().catch(() => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(id);
  }, [playingId]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { playingId, play, stop };
}

// SHA-256 hash of audio file
export async function computeAudioHash(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
