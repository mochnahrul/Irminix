export interface BuildWeapon {
  name: string;
  rarity: number;
  refine: number;
  image: string;
  subStat?: string | null;
  passiveName?: string | null;
  description?: string | null;
}

export interface BuildArtifactPiece {
  name: string;
  rarity: number;
  piece: number;
  image: string;
  bonuses?: string[];
}

export interface BuildArtifactOption {
  name?: string | null;
  rarity: number;
  piece: number;
  image: string;
  bonuses?: string[];
  mix?: BuildArtifactPiece[] | null;
}

export interface CharacterBuildGuide {
  role: string;
  weapons: BuildWeapon[];
  artifacts: BuildArtifactOption[];
  mainStats: string[];
  subStats: string[];
  talentPriority: string[];
}

export interface CharacterSummary {
  id: string;
  name: string;
  weapon: string;
  region: string;
  rarity: number;
  vision: string;
  visionImage: string;
  image: string;
  hasCuratedBuild: boolean;
  roles: string[];
  source: string;
}

export interface CharacterDetail extends CharacterSummary {
  title?: string | null;
  description?: string | null;
  constellation?: string | null;
  birthday?: string | null;
  builds: CharacterBuildGuide[];
  talents: Array<{ name: string; unlock: string; description: string; icon?: string }>;
  constellations: Array<{ name: string; unlock: string; description: string; icon?: string }>;
}

export interface ShowcaseWeapon {
  name: string;
  rarity: number;
  level: number;
  refinement: number;
  baseAtk?: number | null;
  subStat?: string | null;
  iconUrl?: string | null;
}

export interface ShowcaseArtifact {
  slot: string;
  name: string;
  setName: string;
  rarity: number;
  level: number;
  mainStat: string;
  mainStatValue: string;
  subStats: Array<{ stat: string; value: string }>;
  iconUrl?: string | null;
}

export interface ShowcaseCharacter {
  avatarId: number;
  name: string;
  element: string;
  rarity: number;
  level: number;
  friendship: number;
  constellationsUnlocked: number;
  talentLevels: number[];
  stats: Record<string, string>;
  weapon?: ShowcaseWeapon | null;
  artifacts: ShowcaseArtifact[];
  iconUrl?: string | null;
  critValue: number;
}

export interface PlayerProfile {
  uid: string;
  nickname: string;
  level: number;
  worldLevel: number;
  signature: string;
  finishAchievementNum: number;
  towerFloorIndex?: number | null;
  towerLevelIndex?: number | null;
  towerStarIndex?: number | null;
  theaterActIndex?: number | null;
  theaterStarIndex?: number | null;
  stygianIndex?: number | null;
  stygianSeconds?: number | null;
  profilePictureUrl?: string | null;
  showcaseCharacters: ShowcaseCharacter[];
  cached: boolean;
  ttlSeconds: number;
}

export interface BuildAdvisorResponse {
  characterName: string;
  overallGrade: string;
  headline: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendedNextFarm: string;
  dimensions: Array<{ label: string; score: number }>;
  poweredBy: string;
}

export interface AchievementCategory {
  id: string;
  name: string;
  order: number;
  count: number;
}

export interface AchievementItem {
  id: number;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  primogems: number;
  version: string;
}

export interface AchievementCatalogResponse {
  total: number;
  categories: AchievementCategory[];
  items: AchievementItem[];
}

export interface AchievementGuideResponse {
  title: string;
  steps: string[];
  tip: string;
  poweredBy: string;
}
