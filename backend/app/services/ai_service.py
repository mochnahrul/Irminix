from collections import Counter
import json
import logging
from typing import Optional
from google import genai
from app.core.cache import cache
from app.core.config import settings
from app.schemas.advisor import (
    BuildAdvisorRequest,
    BuildAdvisorResponse,
    BuildDimensionScore,
)
from app.schemas.auth import ShowcaseCharacter
from app.schemas.character import CharacterDetail

logger = logging.getLogger(__name__)
ADVISOR_TTL = 60 * 30  # 30 minutes


def _parse_pct(val: str, default: float = 0.0) -> float:
    try:
        return float(val.replace("%", "").replace(",", "").strip())
    except ValueError:
        return default


def _deterministic_advisor(
    character: CharacterDetail,
    showcase: Optional[ShowcaseCharacter],
    role: str,
    tone: str = "scholar",
) -> BuildAdvisorResponse:
    """Context-aware local analyzer inspecting equipped sets, weapons, stats, talents, and tone."""
    primary_build = character.builds[0] if character.builds else None
    rec_weapons = [w.name for w in primary_build.weapons] if primary_build else []
    top_weapon = rec_weapons[0] if rec_weapons else "Signature / 5★ Crit Weapon"

    rec_sets: list[str] = []
    if primary_build:
        for art in primary_build.artifacts:
            if art.name:
                rec_sets.append(art.name)
            elif art.mix:
                rec_sets.extend(m.name for m in art.mix if m.name)
    top_artifact = rec_sets[0] if rec_sets else "Optimal 4-Piece Elemental Set"

    if not showcase:
        summary = (
            f"{top_artifact} + {top_weapon}."
            if tone == "concise"
            else f"For the {role} role, {character.name} performs best with {top_artifact} "
            f"and {top_weapon}. Prioritize "
            f"{', '.join(primary_build.subStats[:3]) if primary_build and primary_build.subStats else 'Crit & ATK%'}."
        )
        return BuildAdvisorResponse(
            characterName=character.name,
            overallGrade="A",
            headline=f"{character.name} — Recommended Build Plan",
            summary=summary,
            strengths=[
                f"Role: {role} ({character.vision}).",
                f"Target pairing: {top_weapon} + {top_artifact}.",
            ],
            improvements=[
                f"Farm {top_artifact} and match recommended main stats.",
                "Add this character to your in-game Showcase to audit equipped gear.",
            ],
            recommendedNextFarm=top_artifact,
            dimensions=[
                BuildDimensionScore(label="Weapon Fit", score=85),
                BuildDimensionScore(label="Artifact CV", score=82),
                BuildDimensionScore(label="Talents", score=84),
                BuildDimensionScore(label="ER Balance", score=80),
                BuildDimensionScore(label="Team Synergy", score=88),
            ],
            poweredBy="irminsul-local-engine",
        )

    is_minmax = tone == "strategist"
    is_short = tone == "concise"
    cv_target = 200 if is_minmax else 170
    talent_target = 9 if is_minmax else 8
    cr_target = 75 if is_minmax else 65

    cv = showcase.critValue
    cr = _parse_pct(showcase.stats.get("Crit Rate", "5%"))
    cd = _parse_pct(showcase.stats.get("Crit DMG", "50%"))
    er = _parse_pct(showcase.stats.get("Energy Recharge", "100%"))

    set_counts = Counter(a.setName for a in showcase.artifacts if a.setName)
    active_4pc = next((s for s, cnt in set_counts.items() if cnt >= 4), None)
    active_2pcs = [s for s, cnt in set_counts.items() if 2 <= cnt < 4]

    rec_sets_lower = {s.lower() for s in rec_sets}
    has_rec_4pc = bool(active_4pc and active_4pc.lower() in rec_sets_lower)

    # Account for 4pc Marechaussee Hunter (+36% CR) & Obsidian Codex (+40% CR)
    effective_cr = cr
    if active_4pc and "marechaussee" in active_4pc.lower():
        effective_cr += 36.0
    elif active_4pc and "obsidian codex" in active_4pc.lower():
        effective_cr += 40.0

    weapon_name = showcase.weapon.name if showcase.weapon else ""
    weapon_in_rec = any(weapon_name.lower() == rw.lower() for rw in rec_weapons[:6])
    weapon_lv = showcase.weapon.level if showcase.weapon else 0

    sorted_talents = sorted(showcase.talentLevels[:3], reverse=True)
    top2_talent_avg = sum(sorted_talents[:2]) / max(1, len(sorted_talents[:2]))

    # Scoring
    weapon_score = (95 if weapon_in_rec else 76) if weapon_lv >= 90 else 65
    set_bonus_pts = 18 if has_rec_4pc else (10 if active_4pc or len(active_2pcs) >= 2 else 0)
    artifact_score = min(98, max(40, int((30 if is_minmax else 35) + cv * 0.25 + set_bonus_pts)))
    talent_score = min(98, max(40, int(top2_talent_avg * 9.5)))
    er_score = 90 if er >= 130 else (82 if er >= 115 else 72)
    synergy_score = 92 if has_rec_4pc else (84 if active_4pc or active_2pcs else 72)

    avg_score = (weapon_score + artifact_score + talent_score + er_score + synergy_score) / 5
    s_cut = 90 if is_minmax else 86
    a_cut = 80 if is_minmax else 76
    grade = "S" if avg_score >= s_cut else "A" if avg_score >= a_cut else "B" if avg_score >= 64 else "C"

    strengths: list[str] = []
    improvements: list[str] = []

    if has_rec_4pc and active_4pc:
        strengths.append(f"Equipped 4pc {active_4pc}, matching the recommended set.")
    elif active_4pc:
        strengths.append(f"Running a complete 4pc {active_4pc} set bonus.")
        if rec_sets:
            improvements.append(f"Consider transitioning to 4pc {top_artifact} for optimal synergy.")
    elif active_2pcs:
        strengths.append(f"Active 2pc bonus from {' + '.join(active_2pcs)}.")
        improvements.append(f"Complete a full 4pc {top_artifact} set instead of mixed pieces.")
    else:
        improvements.append(f"No active 4pc/2pc set bonus detected — farm {top_artifact}.")

    if showcase.weapon:
        if weapon_in_rec and weapon_lv >= 90:
            strengths.append(
                f"Equipped {weapon_name} (Lv.{weapon_lv}, R{showcase.weapon.refinement}), a top recommended weapon."
            )
        elif weapon_lv < 90:
            improvements.append(f"Ascend {weapon_name} from Lv.{weapon_lv} to Lv.90 for full Base ATK & substats.")
        else:
            strengths.append(f"Weapon {weapon_name} is maxed at Lv.{weapon_lv} (R{showcase.weapon.refinement}).")
            if rec_weapons:
                improvements.append(f"Long-term weapon upgrade target: {top_weapon}.")

    if cv >= cv_target:
        strengths.append(f"High-tier artifact quality with {cv} total Crit Value.")
    elif cv >= 135:
        strengths.append(f"Solid baseline artifact stats ({cv} total Crit Value).")
        improvements.append(f"Push artifact Crit Value toward {cv_target}+ by replacing lower-roll pieces.")
    else:
        improvements.append(f"Artifact Crit Value ({cv}) has room to grow — aim for {cv_target}+ CV.")

    if effective_cr < cr_target - 10:
        improvements.append(f"Effective Crit Rate ({effective_cr:.1f}%) is low; aim for {cr_target}%+ for consistent crits.")
    elif active_4pc and ("marechaussee" in active_4pc.lower() or "obsidian codex" in active_4pc.lower()):
        strengths.append(f"4pc {active_4pc} boosts effective Crit Rate to ~{effective_cr:.1f}%.")

    if top2_talent_avg < talent_target:
        improvements.append(f"Level your primary talents to {talent_target}+ for guaranteed damage scaling.")

    if not improvements:
        improvements.append("Build is well-balanced; fine-tune substat rolls via Artifact Strongbox.")

    if weapon_lv < 90:
        next_farm = (
            f"Weapon Ascension Materials for {weapon_name} (Lv.90)"
            if weapon_name
            else f"Equip and ascend a recommended weapon for {character.name} (Lv.90)"
        )
    elif top2_talent_avg < talent_target:
        next_farm = f"Talent Books for {character.name} (Lv.{talent_target}+)"
    elif not has_rec_4pc and top_artifact:
        next_farm = f"{top_artifact} Domain / Strongbox"
    else:
        next_farm = f"{active_4pc or top_artifact} Strongbox (Substat Optimization)"

    max_bullets = 2 if is_short else 3
    mode_tag = "Min-Max Audit" if is_minmax else "Quick Check" if is_short else "Build Audit"
    summary_text = (
        f"Lv.{showcase.level} {character.name} · {f'4pc {active_4pc}' if active_4pc else 'Mixed'} · {cv} CV · {cr:.1f}%/{cd:.1f}% Crit."
        if is_short
        else f"Your Lv.{showcase.level} {character.name} runs "
        f"{f'4pc {active_4pc}' if active_4pc else 'mixed artifacts'} with {cv} CV, "
        f"{cr:.1f}% Crit Rate ({cd:.1f}% Crit DMG), and {er:.1f}% ER."
    )

    return BuildAdvisorResponse(
        characterName=character.name,
        overallGrade=grade,
        headline=f"{character.name} ({role}) — {grade}-Tier {mode_tag}",
        summary=summary_text,
        strengths=strengths[:max_bullets],
        improvements=improvements[:max_bullets],
        recommendedNextFarm=next_farm,
        dimensions=[
            BuildDimensionScore(label="Weapon Fit", score=weapon_score),
            BuildDimensionScore(label="Artifact CV", score=artifact_score),
            BuildDimensionScore(label="Talents", score=talent_score),
            BuildDimensionScore(label="ER Balance", score=er_score),
            BuildDimensionScore(label="Team Synergy", score=synergy_score),
        ],
        poweredBy="irminsul-local-engine",
    )


async def generate_build_advice(
    req: BuildAdvisorRequest,
    character: CharacterDetail,
    showcase: Optional[ShowcaseCharacter] = None,
) -> BuildAdvisorResponse:
    """Analyze a character build with Gemini 2.5 Flash, falling back cleanly if unavailable."""
    from app.core.gemini import GEMINI_MODEL_ID, generate_gemini_json

    role = req.role or (character.builds[0].role if character.builds else "DPS")
    showcase_sig = (
        f"{showcase.level}:{showcase.weapon.name if showcase.weapon else 'none'}:"
        f"{showcase.weapon.level if showcase.weapon else 0}:{len(showcase.artifacts)}:"
        f"{sum(showcase.talentLevels[:3])}"
        if showcase
        else "no_showcase"
    )
    cache_key = f"irminsul:advisor:{character.id}:{req.uid or 'guest'}:{role}:{req.tone}:{showcase_sig}"

    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    if not settings.GEMINI_API_KEY:
        result = _deterministic_advisor(character, showcase, role, req.tone)
        await cache.set(cache_key, result, ttl_seconds=ADVISOR_TTL)
        return result

    prompt_context = {
        "character": character.name,
        "vision": character.vision,
        "weaponType": character.weapon,
        "targetRole": role,
        "tone": req.tone,
        "curatedGuide": character.builds[0].model_dump() if character.builds else None,
        "playerShowcase": showcase.model_dump() if showcase else None,
    }
    prompt = (
        "You are the Irminsul Archive Scholar, a calm, precise Genshin Impact theorycrafter.\n"
        "Analyze the character build data below and return ONLY valid JSON matching this schema:\n"
        "{\n"
        '  "overallGrade": "S|A|B|C",\n'
        '  "headline": "concise title",\n'
        '  "summary": "2-3 sentence calm, actionable assessment",\n'
        '  "strengths": ["point 1", "point 2"],\n'
        '  "improvements": ["point 1", "point 2"],\n'
        '  "recommendedNextFarm": "specific domain or boss",\n'
        '  "dimensions": [\n'
        '    {"label": "Weapon Fit", "score": 0-100},\n'
        '    {"label": "Artifact CV", "score": 0-100},\n'
        '    {"label": "Talents", "score": 0-100},\n'
        '    {"label": "ER Balance", "score": 0-100},\n'
        '    {"label": "Team Synergy", "score": 0-100}\n'
        "  ]\n"
        "}\n"
        f"Data:\n{json.dumps(prompt_context, default=str)[:4500]}"
    )
    parsed = await generate_gemini_json(prompt)
    if parsed is not None:
        try:
            raw_dims = parsed.get("dimensions")
            dims = [
                BuildDimensionScore(**d)
                for d in (raw_dims if isinstance(raw_dims, list) else [])
                if isinstance(d, dict)
            ]
            raw_strengths = parsed.get("strengths")
            raw_improvements = parsed.get("improvements")
            result = BuildAdvisorResponse(
                characterName=character.name,
                overallGrade=str(parsed.get("overallGrade") or "A"),
                headline=str(parsed.get("headline") or f"{character.name} Build Analysis"),
                summary=str(parsed.get("summary") or ""),
                strengths=[str(x) for x in raw_strengths] if isinstance(raw_strengths, list) else [],
                improvements=[str(x) for x in raw_improvements] if isinstance(raw_improvements, list) else [],
                recommendedNextFarm=str(parsed.get("recommendedNextFarm") or "Artifact Strongbox"),
                dimensions=dims,
                poweredBy=GEMINI_MODEL_ID,
            )
            await cache.set(cache_key, result, ttl_seconds=ADVISOR_TTL)
            return result
        except Exception as exc:
            logger.warning("Gemini advisor response validation failed: %s", exc)

    return _deterministic_advisor(character, showcase, role, req.tone)
