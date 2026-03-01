import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Get VAPID public key from edge function
const getVapidPublicKey = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("get-vapid-key");
    if (error) throw error;
    return data?.publicKey || null;
  } catch (err) {
    console.error("Error fetching VAPID key:", err);
    return null;
  }
};

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

export function usePushNotifications() {
  const { publicKey } = useWallet();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check subscription status on wallet connect
  useEffect(() => {
    if (!publicKey || !isSupported) {
      setIsSubscribed(false);
      return;
    }

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await (registration as any).pushManager?.getSubscription();
        
        if (subscription) {
          // Verify subscription exists in database
          const { data } = await supabase
            .from("push_subscriptions")
            .select("id")
            .eq("wallet_address", publicKey.toBase58())
            .eq("endpoint", subscription.endpoint)
            .maybeSingle();
          
          setIsSubscribed(!!data);
        } else {
          setIsSubscribed(false);
        }
      } catch (err) {
        console.error("Error checking subscription:", err);
        setIsSubscribed(false);
      }
    };

    checkSubscription();
  }, [publicKey, isSupported]);

  const subscribe = useCallback(async () => {
    if (!publicKey || !isSupported) return false;

    setIsLoading(true);
    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      
      if (permissionResult !== "granted") {
        toast.error("Notification permission denied");
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Get VAPID key
      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        throw new Error("Could not get VAPID key");
      }

      // Subscribe to push
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subscriptionJson = subscription.toJSON();
      
      // Save via edge function
      const { error } = await supabase.functions.invoke("manage-user-data", {
        body: {
          action: "upsert_push_subscription",
          walletAddress: publicKey.toBase58(),
          endpoint: subscription.endpoint,
          p256dh: subscriptionJson.keys?.p256dh || "",
          auth: subscriptionJson.keys?.auth || "",
        },
      });

      if (error) throw error;

      setIsSubscribed(true);
      toast.success("Push notifications enabled!");
      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to enable notifications";
      console.error("Error subscribing:", err);
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!publicKey || !isSupported) return false;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager?.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove via edge function
        await supabase.functions.invoke("manage-user-data", {
          body: {
            action: "delete_push_subscription",
            walletAddress: publicKey.toBase58(),
            endpoint: subscription.endpoint,
          },
        });
      }

      setIsSubscribed(false);
      toast.success("Push notifications disabled");
      return true;
    } catch (err) {
      console.error("Error unsubscribing:", err);
      toast.error("Failed to disable notifications");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, isSupported]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  };
}
