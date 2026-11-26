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
  buildLastUpdated?: string | null;
  versionReleased?: string | null;
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

export interface TierEntry {
  character: CharacterSummary;
  tier: string;
  roleGroup: string;
}

export interface TierListResponse {
  patchLabel: string;
  entries: TierEntry[];
}

export interface GearUserRecommendation {
  characterId: string;
  name: string;
  vision: string;
  rarity: number;
  image: string;
  role: string;
  rank: number;
}

export interface WeaponItem {
  id: number;
  name: string;
  rarity: number;
  weaponType: string;
  subStat?: string | null;
  image: string;
  recommendedFor?: GearUserRecommendation[];
}

export interface WeaponDetailResponse extends WeaponItem {
  description: string;
  passiveName?: string | null;
  passiveDescription?: string | null;
}

export interface ArtifactSetItem {
  id: number;
  name: string;
  maxRarity: number;
  image: string;
  bonuses: string[];
  recommendedFor?: GearUserRecommendation[];
}

export interface ElementalResonanceItem {
  id: string;
  name: string;
  description: string;
}

export interface ElementalReactionItem {
  name: string;
  elements: string[];
  category: string;
  scaling: string;
  description: string;
}

export interface ElementsDatabaseResponse {
  resonances: ElementalResonanceItem[];
  reactions: ElementalReactionItem[];
}

export interface MaterialBrief {
  id: number;
  name: string;
  rank: number;
  icon: string;
  count: number;
}

export interface DomainScheduleItem {
  id: number;
  name: string;
  city: string;
  category: string;
  materials: MaterialBrief[];
  characters: CharacterSummary[];
}

export interface DailyFarmingResponse {
  day: string;
  availableDays: string[];
  talentDomains: DomainScheduleItem[];
  weaponDomains: DomainScheduleItem[];
}

export interface AscensionStagePlan {
  promoteLevel: number;
  unlockMaxLevel: number;
  coinCost: number;
  items: MaterialBrief[];
}

export interface TalentStagePlan {
  level: number;
  coinCost: number;
  items: MaterialBrief[];
}

export interface CharacterMaterialPlanResponse {
  characterId: string;
  name: string;
  rarity: number;
  vision: string;
  image: string;
  ascensionStages: AscensionStagePlan[];
  talentStages: TalentStagePlan[];
}

export interface TeamAnalyzeResponse {
  characters: CharacterSummary[];
  activeResonances: ElementalResonanceItem[];
  triggerableReactions: ElementalReactionItem[];
  roleCounts: Record<string, number>;
  synergyNotes: string[];
}
