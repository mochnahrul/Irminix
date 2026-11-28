import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { connectUid as apiConnectUid, fetchProfile } from "@/services/api";
import type { PlayerProfile } from "@/types/genshin";

const UID_STORAGE_KEY = "irminsul:uid";
const GUEST_STORAGE_KEY = "irminsul:guest";

interface SessionContextValue {
  profile: PlayerProfile | null;
  uid: string | null;
  isGuest: boolean;
  isConnecting: boolean;
  error: string | null;
  connectUid: (uid: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  enterGuestMode: () => void;
  disconnect: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(() => localStorage.getItem(UID_STORAGE_KEY));
  const [isGuest, setIsGuest] = useState<boolean>(
    () => localStorage.getItem(GUEST_STORAGE_KEY) === "true"
  );
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const loadedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || loadedUidRef.current === uid) return;
    let cancelled = false;
    setIsConnecting(true);
    setError(null);
    fetchProfile(uid)
      .then((data) => {
        if (!cancelled) {
          loadedUidRef.current = uid;
          setProfile(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load saved UID.";
          if (/not found|invalid uid/i.test(msg)) {
            localStorage.removeItem(UID_STORAGE_KEY);
            setUid(null);
          } else {
            setError(msg);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsConnecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const activeUidRef = useRef<string | null>(uid);
  activeUidRef.current = uid;

  const connectUid = async (rawUid: string) => {
    setError(null);
    setIsConnecting(true);
    try {
      const data = await apiConnectUid(rawUid.trim());
      loadedUidRef.current = data.uid;
      setProfile(data);
      setUid(data.uid);
      setIsGuest(false);
      try {
        localStorage.setItem(UID_STORAGE_KEY, data.uid);
        localStorage.removeItem(GUEST_STORAGE_KEY);
      } catch {
        // Ignore storage errors in restricted browsing modes
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect UID.";
      setError(message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  const refreshProfile = async () => {
    const targetUid = uid;
    if (!targetUid) return;
    setIsConnecting(true);
    setError(null);
    try {
      const data = await fetchProfile(targetUid, true);
      if (activeUidRef.current === targetUid) {
        setProfile(data);
      }
    } catch (err) {
      if (activeUidRef.current === targetUid) {
        setError(err instanceof Error ? err.message : "Failed to refresh showcase.");
      }
    } finally {
      if (activeUidRef.current === targetUid) {
        setIsConnecting(false);
      }
    }
  };

  const enterGuestMode = () => {
    setError(null);
    setIsGuest(true);
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, "true");
    } catch {
      // Ignore storage errors
    }
  };

  const disconnect = () => {
    loadedUidRef.current = null;
    setProfile(null);
    setUid(null);
    setIsGuest(false);
    setError(null);
    try {
      localStorage.removeItem(UID_STORAGE_KEY);
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <SessionContext.Provider
      value={{
        profile,
        uid,
        isGuest,
        isConnecting,
        error,
        connectUid,
        refreshProfile,
        enterGuestMode,
        disconnect,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
