import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MyInstantSound {
  id: string;
  url?: string;
  title: string;
  mp3: string;
  description?: string;
  tags?: string[];
  views?: number;
  favorites?: number;
  uploader?: { name?: string; url?: string };
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

export type SoundTab = "all" | "trending" | "recent" | "search";

export const SOUND_CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "funny", label: "Funny" },
  { value: "memes", label: "Memes" },
  { value: "games", label: "Games" },
  { value: "movies", label: "Movies" },
  { value: "music", label: "Music" },
  { value: "anime", label: "Anime" },
  { value: "animals", label: "Animals" },
  { value: "cartoons", label: "Cartoons" },
  { value: "celebrities", label: "Celebrities" },
  { value: "tv", label: "TV Shows" },
  { value: "sports", label: "Sports" },
  { value: "horror", label: "Horror" },
  { value: "sound-effects", label: "Sound Effects" },
] as const;

// Proxy all MyInstants API calls through our edge function
async function proxyFetch(endpoint: string, params?: Record<string, string>): Promise<MyInstantSound[]> {
  try {
    const { data, error } = await supabase.functions.invoke("myinstants-proxy", {
      body: { endpoint, params },
    });

    if (error) {
      console.warn(`Proxy fetch warning (${endpoint}):`, error.message);
      return [];
    }

    if (!Array.isArray(data)) {
      console.warn("Unexpected response format:", data);
      return [];
    }

    console.log(`MyInstants ${endpoint} returned ${data.length} items`);
    return data;
  } catch (err) {
    console.warn(`proxyFetch ${endpoint} failed:`, err);
    return [];
  }
}

// Trending: fetch multiple regions and deduplicate
async function fetchTrending(): Promise<MyInstantSound[]> {
  const regions = ["us", "br", "gb", "id", "fr", "de", "es", "mx"];

  const results = await Promise.allSettled(
    regions.map(q => proxyFetch("trending", { q }))
  );

  const allSounds: MyInstantSound[] = [];
  const seenIds = new Set<string>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const sound of result.value) {
        if (!seenIds.has(sound.id)) {
          seenIds.add(sound.id);
          allSounds.push(sound);
        }
      }
    }
  }

  // Sort by views DESC
  allSounds.sort((a, b) => (b.views || 0) - (a.views || 0));
  return allSounds;
}

async function fetchRecent(): Promise<MyInstantSound[]> {
  return proxyFetch("recent");
}

async function fetchBest(): Promise<MyInstantSound[]> {
  const sounds = await proxyFetch("best");
  // Sort by favorites DESC
  sounds.sort((a, b) => (b.favorites || 0) - (a.favorites || 0));
  return sounds;
}

async function searchSounds(query: string): Promise<MyInstantSound[]> {
  return proxyFetch("search", { q: query });
}

export function useSoundBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SoundTab>("trending");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const queryClient = useQueryClient();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        setDebouncedQuery(searchQuery.trim());
        setActiveTab("search");
      } else if (activeTab === "search") {
        setActiveTab("trending");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const trendingQuery = useQuery({
    queryKey: ["sounds", "trending"],
    queryFn: fetchTrending,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: activeTab === "trending",
  });

  const recentQuery = useQuery({
    queryKey: ["sounds", "recent"],
    queryFn: fetchRecent,
    staleTime: 2 * 60 * 1000,
    retry: 2,
    enabled: activeTab === "recent",
  });

  const bestQuery = useQuery({
    queryKey: ["sounds", "best"],
    queryFn: fetchBest,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: activeTab === "best",
  });

  const searchResultsQuery = useQuery({
    queryKey: ["sounds", "search", debouncedQuery],
    queryFn: () => searchSounds(debouncedQuery),
    enabled: !!debouncedQuery && activeTab === "search",
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  const activeQuery = {
    trending: trendingQuery,
    recent: recentQuery,
    best: bestQuery,
    search: searchResultsQuery,
  }[activeTab];

  const sounds = activeQuery.data;
  const isLoading = activeQuery.isLoading;
  const error = activeQuery.error;

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
    refetchInterval: 30000,
  });

  // Merge sounds with registry status
  const soundsWithStatus: SoundWithStatus[] = (sounds || []).map(sound => {
    const entry = registryQuery.data?.find(r => r.sound_id === sound.id);
    let mintStatus: SoundMintStatus = "available";
    if (entry) {
      if (entry.status === "minted") mintStatus = "minted";
      else if (entry.status === "reserved") {
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
    activeQuery.refetch();
  }, [activeQuery]);

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

  const play = useCallback((id: string, mp3Url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingId === id) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(mp3Url);
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
