from pydantic import BaseModel
from app.schemas.character import CharacterSummary
from app.services.catalog_service import get_all_characters


class TierEntry(BaseModel):
    character: CharacterSummary
    tier: str
    roleGroup: str


class TierListResponse(BaseModel):
    patchLabel: str
    entries: list[TierEntry]


# Version 7.2 Tier List aligned with Spiral Abyss & Stygian Onslaught usage
TIER_OVERRIDES: dict[str, tuple[str, str]] = {
    # S Tier
    "arlecchino": ("S", "Main DPS"),
    "citlali": ("S", "Support"),
    "columbina": ("S", "Support"),
    "durin": ("S", "Sub DPS"),
    "escoffier": ("S", "Sub DPS"),
    "flins": ("S", "Main DPS"),
    "furina": ("S", "Sub DPS"),
    "ineffa": ("S", "Sub DPS"),
    "mavuika": ("S", "Main DPS"),
    "mitya": ("S", "Main DPS"),
    "nicole": ("S", "Support"),
    "odette": ("S", "Support"),
    "qiqi": ("S", "Sub DPS"),
    "sandrone": ("S", "Main DPS"),
    "skirk": ("S", "Main DPS"),
    "vasma": ("S", "Main DPS"),
    "vedyantova": ("S", "Support"),
    "wriothesley": ("S", "Main DPS"),
    "xilonen": ("S", "Support"),
    "yae-miko": ("S", "Sub DPS"),
    "zibai": ("S", "Main DPS"),
    "alyosha": ("S", "Support"),
    "sucrose": ("S", "Support"),
    # A Tier
    "kazuha": ("A", "Support"),
    "kaedehara-kazuha": ("A", "Support"),
    "lauma": ("A", "Support"),
    "linnea": ("A", "Support"),
    "lohen": ("A", "Main DPS"),
    "mona": ("A", "Support"),
    "nefer": ("A", "Main DPS"),
    "shenhe": ("A", "Support"),
    "traveler-cryo": ("A", "Main DPS"),
    "varka": ("A", "Main DPS"),
    "yelan": ("A", "Sub DPS"),
    "yumemizuki-mizuki": ("A", "Main DPS"),
    "bennett": ("A", "Support"),
    "diona": ("A", "Support"),
    "faruzan": ("A", "Support"),
    "fischl": ("A", "Sub DPS"),
    # B Tier
    "ayaka": ("B", "Main DPS"),
    "kamisato-ayaka": ("B", "Main DPS"),
    "chasca": ("B", "Main DPS"),
    "cyno": ("B", "Main DPS"),
    "kinich": ("B", "Main DPS"),
    "klee": ("B", "Main DPS"),
    "nahida": ("B", "Sub DPS"),
    "neuvillette": ("B", "Main DPS"),
    "raiden-shogun": ("B", "Sub DPS"),
    "traveler-pyro": ("B", "Support"),
    "varesa": ("B", "Main DPS"),
    "venti": ("B", "Sub DPS"),
    "wanderer": ("B", "Main DPS"),
    "zhongli": ("B", "Support"),
    "chevreuse": ("B", "Support"),
    "iansan": ("B", "Support"),
    "illuga": ("B", "Sub DPS"),
    "valeriy": ("B", "Support"),
    # C Tier
    "albedo": ("C", "Sub DPS"),
    "ayato": ("C", "Main DPS"),
    "kamisato-ayato": ("C", "Main DPS"),
    "baizhu": ("C", "Support"),
    "childe": ("C", "Main DPS"),
    "tartaglia": ("C", "Main DPS"),
    "chiori": ("C", "Sub DPS"),
    "clorinde": ("C", "Main DPS"),
    "emilie": ("C", "Sub DPS"),
    "ganyu": ("C", "Sub DPS"),
    "hu-tao": ("C", "Main DPS"),
    "kokomi": ("C", "Support"),
    "sangonomiya-kokomi": ("C", "Support"),
    "lyney": ("C", "Main DPS"),
    "mualani": ("C", "Main DPS"),
    "navia": ("C", "Main DPS"),
    "nilou": ("C", "Sub DPS"),
    "sigewinne": ("C", "Support"),
    "traveler-dendro": ("C", "Sub DPS"),
    "xianyun": ("C", "Support"),
    "xiao": ("C", "Main DPS"),
    "yoimiya": ("C", "Main DPS"),
    "aino": ("C", "Support"),
    "charlotte": ("C", "Support"),
    "kuki-shinobu": ("C", "Sub DPS"),
    "lan-yan": ("C", "Support"),
    "layla": ("C", "Support"),
    "ororon": ("C", "Sub DPS"),
    "prune": ("C", "Support"),
    "xiangling": ("C", "Sub DPS"),
    "xingqiu": ("C", "Sub DPS"),
}


def infer_role_group(char: CharacterSummary) -> str:
    """Infer Main DPS / Sub DPS / Support from TIER_OVERRIDES or character roles."""
    override = TIER_OVERRIDES.get(char.id.lower())
    if override:
        return override[1]
    joined = " ".join(char.roles).upper().replace("-", " ")
    if "SUB" in joined or "OFF FIELD" in joined:
        return "Sub DPS"
    if "SUPPORT" in joined or "HEALER" in joined or "SHIELD" in joined:
        return "Support"
    if "MAIN" in joined or "ON FIELD" in joined or "DPS" in joined:
        return "Main DPS"
    return "Support"


def _infer_role_group(char: CharacterSummary) -> str:
    return infer_role_group(char)


async def get_tier_list() -> TierListResponse:
    characters = await get_all_characters()
    entries: list[TierEntry] = []

    for ch in characters:
        if ch.id in TIER_OVERRIDES:
            tier, role_group = TIER_OVERRIDES[ch.id]
        else:
            tier = "D"
            role_group = _infer_role_group(ch)
        entries.append(TierEntry(character=ch, tier=tier, roleGroup=role_group))

    tier_order = {"S": 0, "A": 1, "B": 2, "C": 3, "D": 4}
    entries.sort(
        key=lambda e: (
            tier_order.get(e.tier, 9),
            -e.character.rarity,
            e.character.name.lower(),
        )
    )

    return TierListResponse(
        patchLabel="Version 7.2 · Abyss & Stygian Usage",
        entries=entries,
    )
