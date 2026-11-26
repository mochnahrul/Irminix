import { useEffect, useState } from "react";
import { AiBuildAdvisorView } from "@/components/advisor/AiBuildAdvisorView";
import { UidLoginView } from "@/components/auth/UidLoginView";
import { CharacterBuildDetailView } from "@/components/build/CharacterBuildDetailView";
import { CharacterCodexView } from "@/components/characters/CharacterCodexView";
import { type ActiveTab } from "@/components/common/Navbar";
import { DatabaseView } from "@/components/database/DatabaseView";
import { AppShell } from "@/components/layout/AppShell";
import { FarmingPlannerView } from "@/components/planner/FarmingPlannerView";
import { UidShowcaseView } from "@/components/showcase/UidShowcaseView";
import { TeamBuilderView } from "@/components/teams/TeamBuilderView";
import { TierListView } from "@/components/tierlist/TierListView";
import { SessionProvider, useSession } from "@/contexts/SessionContext";
import { fetchCharacters } from "@/services/api";
import type { CharacterSummary } from "@/types/genshin";

function IrminsulAppContent() {
  const { uid, isGuest } = useSession();
  const [activeTab, setActiveTab] = useState<ActiveTab>("codex");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [advisorTarget, setAdvisorTarget] = useState<{
    name: string;
    role?: string;
  } | null>(null);
  const [plannerTarget, setPlannerTarget] = useState<{
    characterId: string;
    subTab: "daily" | "calculator";
  } | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  useEffect(() => {
    fetchCharacters()
      .then(setCharacters)
      .catch(() => setCharacters([]))
      .finally(() => setLoadingCatalog(false));
  }, []);

  if (!uid && !isGuest) {
    return <UidLoginView />;
  }

  const openAdvisorFor = (characterName: string, role?: string) => {
    setAdvisorTarget({ name: characterName, role });
    setSelectedCharacterId(null);
    setActiveTab("advisor");
  };

  const openCalculatorFor = (characterId: string) => {
    setPlannerTarget({ characterId, subTab: "calculator" });
    setActiveTab("planner");
  };

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onResetCharacter={() => setSelectedCharacterId(null)}
    >
      {activeTab === "codex" &&
        (selectedCharacterId ? (
          <CharacterBuildDetailView
            characterId={selectedCharacterId}
            onBack={() => setSelectedCharacterId(null)}
            onOpenAdvisor={openAdvisorFor}
            onOpenCalculator={openCalculatorFor}
          />
        ) : (
          <CharacterCodexView
            characters={characters}
            loading={loadingCatalog}
            onSelectCharacter={setSelectedCharacterId}
          />
        ))}

      {activeTab === "tierlist" && (
        <TierListView
          onSelectCharacter={(id) => {
            setSelectedCharacterId(id);
            setActiveTab("codex");
          }}
        />
      )}

      {activeTab === "teams" && (
        <TeamBuilderView
          characters={characters}
          onSelectCharacter={(id) => {
            setSelectedCharacterId(id);
            setActiveTab("codex");
          }}
        />
      )}

      {activeTab === "planner" && (
        <FarmingPlannerView
          characters={characters}
          initialSubTab={plannerTarget?.subTab}
          initialCharacterId={plannerTarget?.characterId}
          onSelectCharacter={(id) => {
            setSelectedCharacterId(id);
            setActiveTab("codex");
          }}
        />
      )}

      {activeTab === "database" && (
        <DatabaseView
          onSelectCharacter={(id) => {
            setSelectedCharacterId(id);
            setActiveTab("codex");
          }}
        />
      )}

      {activeTab === "showcase" && (
        <UidShowcaseView
          allCharacters={characters}
          onOpenAdvisor={(name) => openAdvisorFor(name)}
          onOpenCodexCharacter={(id) => {
            setSelectedCharacterId(id);
            setActiveTab("codex");
          }}
        />
      )}

      {activeTab === "advisor" && (
        <AiBuildAdvisorView
          characters={characters}
          initialCharacter={advisorTarget?.name}
          initialRole={advisorTarget?.role}
        />
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <IrminsulAppContent />
    </SessionProvider>
  );
}
