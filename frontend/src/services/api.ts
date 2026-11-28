import type {
  AchievementCatalogResponse,
  AchievementGuideResponse,
  ArtifactSetItem,
  BuildAdvisorResponse,
  CharacterDetail,
  CharacterMaterialPlanResponse,
  CharacterSummary,
  DailyFarmingResponse,
  ElementsDatabaseResponse,
  PlayerProfile,
  TeamAnalyzeResponse,
  TierListResponse,
  WeaponDetailResponse,
  WeaponItem,
} from "@/types/genshin";

const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes, matching Valvix client cache

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T): void {
  memoryCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const defaultHeaders: Record<string, string> = init?.body
    ? { "Content-Type": "application/json" }
    : {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...defaultHeaders, ...(init?.headers || {}) },
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function connectUid(uid: string): Promise<PlayerProfile> {
  const profile = await request<PlayerProfile>("/api/auth/connect", {
    method: "POST",
    body: JSON.stringify({ uid }),
  });
  setCached(`profile:${profile.uid}`, profile);
  return profile;
}

export async function fetchProfile(uid: string, refresh = false): Promise<PlayerProfile> {
  const key = `profile:${uid}`;
  if (!refresh) {
    const cached = getCached<PlayerProfile>(key);
    if (cached) return cached;
  }
  const profile = await request<PlayerProfile>(
    `/api/auth/profile/${encodeURIComponent(uid)}?refresh=${refresh}`
  );
  setCached(key, profile);
  return profile;
}

export async function fetchCharacters(): Promise<CharacterSummary[]> {
  const key = "characters:all";
  const cached = getCached<CharacterSummary[]>(key);
  if (cached) return cached;

  const data = await request<CharacterSummary[]>("/api/characters");
  setCached(key, data);
  return data;
}

export async function fetchCharacterDetail(identifier: string): Promise<CharacterDetail> {
  const key = `character:${identifier}`;
  const cached = getCached<CharacterDetail>(key);
  if (cached) return cached;

  const data = await request<CharacterDetail>(
    `/api/characters/${encodeURIComponent(identifier)}`
  );
  setCached(key, data);
  return data;
}

export async function fetchBuildAdvice(payload: {
  characterName: string;
  uid?: string;
  role?: string;
  tone?: string;
}): Promise<BuildAdvisorResponse> {
  return request<BuildAdvisorResponse>("/api/advisor", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAchievements(): Promise<AchievementCatalogResponse> {
  const key = "achievements:all";
  const cached = getCached<AchievementCatalogResponse>(key);
  if (cached) return cached;

  const data = await request<AchievementCatalogResponse>("/api/achievements");
  setCached(key, data);
  return data;
}

export async function fetchAchievementGuide(payload: {
  title: string;
  description: string;
  categoryName: string;
}): Promise<AchievementGuideResponse> {
  return request<AchievementGuideResponse>("/api/achievements/guide", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchTierList(): Promise<TierListResponse> {
  const key = "tierlist:all";
  const cached = getCached<TierListResponse>(key);
  if (cached) return cached;

  const data = await request<TierListResponse>("/api/tier-list");
  setCached(key, data);
  return data;
}

export async function fetchDatabaseWeapons(): Promise<WeaponItem[]> {
  const key = "db:weapons";
  const cached = getCached<WeaponItem[]>(key);
  if (cached) return cached;

  const data = await request<WeaponItem[]>("/api/database/weapons");
  setCached(key, data);
  return data;
}

export async function fetchDatabaseWeaponDetail(
  weaponId: number
): Promise<WeaponDetailResponse> {
  const key = `db:weapon:${weaponId}`;
  const cached = getCached<WeaponDetailResponse>(key);
  if (cached) return cached;

  const data = await request<WeaponDetailResponse>(
    `/api/database/weapons/${weaponId}`
  );
  setCached(key, data);
  return data;
}

export async function fetchDatabaseArtifacts(): Promise<ArtifactSetItem[]> {
  const key = "db:artifacts";
  const cached = getCached<ArtifactSetItem[]>(key);
  if (cached) return cached;

  const data = await request<ArtifactSetItem[]>("/api/database/artifacts");
  setCached(key, data);
  return data;
}

export async function fetchDatabaseElements(): Promise<ElementsDatabaseResponse> {
  const key = "db:elements";
  const cached = getCached<ElementsDatabaseResponse>(key);
  if (cached) return cached;

  const data = await request<ElementsDatabaseResponse>("/api/database/elements");
  setCached(key, data);
  return data;
}

export async function fetchDailyFarming(day?: string): Promise<DailyFarmingResponse> {
  const query = day ? `?day=${encodeURIComponent(day)}` : "";
  const key = `farming:daily:${day || "today"}`;
  const cached = getCached<DailyFarmingResponse>(key);
  if (cached) return cached;

  const data = await request<DailyFarmingResponse>(`/api/farming/daily${query}`);
  setCached(key, data);
  return data;
}

export async function fetchCharacterMaterialPlan(
  identifier: string
): Promise<CharacterMaterialPlanResponse> {
  const key = `planner:char:${identifier}`;
  const cached = getCached<CharacterMaterialPlanResponse>(key);
  if (cached) return cached;

  const data = await request<CharacterMaterialPlanResponse>(
    `/api/planner/character/${encodeURIComponent(identifier)}`
  );
  setCached(key, data);
  return data;
}

export async function analyzeTeamComp(characterIds: string[]): Promise<TeamAnalyzeResponse> {
  return request<TeamAnalyzeResponse>("/api/teams/analyze", {
    method: "POST",
    body: JSON.stringify({ characterIds }),
  });
}
