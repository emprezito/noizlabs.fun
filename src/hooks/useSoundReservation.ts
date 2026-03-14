import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { computeAudioHash, type SoundWithStatus } from "./useSoundBrowser";

interface ReservationState {
  soundId: string;
  expiresAt: Date;
  sound: SoundWithStatus;
}

export function useSoundReservation(onRefetchRegistry: () => void) {
  const { publicKey } = useWallet();
  const [reservation, setReservation] = useState<ReservationState | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Countdown timer
  useEffect(() => {
    if (!reservation) {
      setTimeLeft(0);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.floor((reservation.expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        // Reservation expired
        releaseReservation();
        toast.error("Reservation expired. Sound is available again.");
      }
    };

    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current);
  }, [reservation]);

  const reserve = useCallback(async (sound: SoundWithStatus) => {
    if (!publicKey) {
      toast.error("Connect your wallet first!");
      return false;
    }

    setIsReserving(true);
    try {
      // Compute audio hash for duplicate detection
      let audioHash: string | undefined;
      try {
        audioHash = await computeAudioHash(sound.mp3);
      } catch {
        console.warn("Could not compute audio hash, proceeding without it");
      }

      const { data, error } = await supabase.functions.invoke("sounds-registry", {
        body: {
          action: "reserve",
          soundId: sound.id,
          audioUrl: sound.mp3_url,
          audioHash,
          walletAddress: publicKey.toBase58(),
        },
      });

      if (error || !data?.success) {
        const msg = data?.error || error?.message || "Failed to reserve sound";
        toast.error(msg);
        onRefetchRegistry();
        return false;
      }

      const expiresAt = new Date(data.entry.reservation_expires_at);
      setReservation({ soundId: sound.id, expiresAt, sound });
      onRefetchRegistry();
      return true;
    } catch (err: any) {
      toast.error(err.message || "Oof, someone snatched that one. The chain doesn't lie 😅");
      return false;
    } finally {
      setIsReserving(false);
    }
  }, [publicKey, onRefetchRegistry]);

  const releaseReservation = useCallback(async () => {
    if (!reservation || !publicKey) return;

    try {
      await supabase.functions.invoke("sounds-registry", {
        body: {
          action: "release_reservation",
          soundId: reservation.soundId,
          walletAddress: publicKey.toBase58(),
        },
      });
    } catch {
      // Best effort
    }
    setReservation(null);
    clearInterval(timerRef.current);
    onRefetchRegistry();
  }, [reservation, publicKey, onRefetchRegistry]);

  const completeMint = useCallback(async (
    tokenName: string,
    tokenTicker: string,
    tokenAddress: string
  ) => {
    if (!reservation || !publicKey) return false;

    try {
      const { data, error } = await supabase.functions.invoke("sounds-registry", {
        body: {
          action: "complete_mint",
          soundId: reservation.soundId,
          walletAddress: publicKey.toBase58(),
          tokenName,
          tokenTicker,
          tokenAddress,
        },
      });

      if (error) throw error;

      setReservation(null);
      clearInterval(timerRef.current);
      onRefetchRegistry();
      return true;
    } catch {
      toast.error("Failed to record mint completion");
      return false;
    }
  }, [reservation, publicKey, onRefetchRegistry]);

  const formatTimeLeft = useCallback(() => {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [timeLeft]);

  return {
    reservation,
    isReserving,
    timeLeft,
    formatTimeLeft,
    reserve,
    releaseReservation,
    completeMint,
  };
}
