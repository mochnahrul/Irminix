import React, { createContext, useContext, useEffect, useState } from "react";
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

  useEffect(() => {
    if (!uid || profile) return;
    let cancelled = false;
    setIsConnecting(true);
    fetchProfile(uid)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(UID_STORAGE_KEY);
          setUid(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsConnecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, profile]);

  const connectUid = async (rawUid: string) => {
    setError(null);
    setIsConnecting(true);
    try {
      const data = await apiConnectUid(rawUid.trim());
      setProfile(data);
      setUid(data.uid);
      setIsGuest(false);
      localStorage.setItem(UID_STORAGE_KEY, data.uid);
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect UID.";
      setError(message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  const refreshProfile = async () => {
    if (!uid) return;
    setIsConnecting(true);
    setError(null);
    try {
      const data = await fetchProfile(uid, true);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh showcase.");
    } finally {
      setIsConnecting(false);
    }
  };

  const enterGuestMode = () => {
    setError(null);
    setIsGuest(true);
    localStorage.setItem(GUEST_STORAGE_KEY, "true");
  };

  const disconnect = () => {
    setProfile(null);
    setUid(null);
    setIsGuest(false);
    setError(null);
    localStorage.removeItem(UID_STORAGE_KEY);
    localStorage.removeItem(GUEST_STORAGE_KEY);
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
