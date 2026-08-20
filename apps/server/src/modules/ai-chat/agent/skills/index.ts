import type { SkillSlug } from "@wandit/contracts";

import { ADS_SKILL_SLUGS, ADS_SKILLS } from "../ads";

/**
 * Skill registry — progressive disclosure for the brain.
 *
 * Each skill is a playbook the model pulls through the read_skill tool when
 * the task actually needs it; the system prompt and the per-request ads block
 * carry only one-line descriptions. That keeps every ordinary message cheap
 * and the domain knowledge deep.
 *
 * Playbooks are TypeScript constants (see ../ads/index.ts for why), never .md
 * files: the production tsdown bundle carries no markdown assets.
 *
 * To add a skill: export its doc as a TS constant, add its slug to
 * `skillSlugSchema` in @wandit/contracts, and add an entry below.
 */
export type SkillEntry = {
	/** One-liner telling the model when to load it. */
	description: string;
	load: () => Promise<string>;
	/** Retired skills stay in the enum so old chats validate; they load a short note. */
	retired?: true;
};

const RETIRED_LANDING_PAGE_DESIGN_NOTE =
	"The landing-page-design skill is retired: the page builder carries its design constitution in its own system prompt now. Nothing to load — continue with get_direction_candidates and generate_page as usual.";

export const SKILLS: Record<SkillSlug, SkillEntry> = {
	// Kept for history validation only — landing-page-design.md beside this
	// file is the archived text; the builder prompt is the live source.
	"landing-page-design": {
		description:
			"RETIRED — the page builder carries its design guidance itself; do not load.",
		load: async () => RETIRED_LANDING_PAGE_DESIGN_NOTE,
		retired: true,
	},
	...Object.fromEntries(
		ADS_SKILL_SLUGS.map((slug) => [
			slug,
			{
				description: ADS_SKILLS[slug].description,
				load: async () => ADS_SKILLS[slug].doc,
			} satisfies SkillEntry,
		]),
	),
} as Record<SkillSlug, SkillEntry>;

/** Slugs the live read_skill tool advertises (retired ones are excluded). */
export const LIVE_SKILL_SLUGS: readonly SkillSlug[] = (
	Object.keys(SKILLS) as SkillSlug[]
).filter((slug) => !SKILLS[slug].retired);

export async function loadSkill(slug: SkillSlug): Promise<string> {
	return SKILLS[slug].load();
}
