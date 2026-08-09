import { readFile } from "node:fs/promises";

import type { SkillSlug } from "@wandit/contracts";

/**
 * Skill registry — progressive disclosure for the brain.
 *
 * Each skill is a markdown playbook sitting next to this file. The system
 * prompt lists only the one-line descriptions below; the model pulls the
 * full text through the read_skill tool when the task actually needs it.
 * That keeps every ordinary message cheap and the design knowledge deep.
 *
 * To add a skill: drop a .md file here, add its slug to `skillSlugSchema`
 * in @wandit/contracts, and add an entry below — nothing else to wire.
 *
 * NOTE: load() reads the .md relative to this module, which works under
 * dev (tsx runs from src/). The production `tsdown` bundle does not carry
 * .md assets yet — revisit when a real deploy pipeline exists.
 */
type SkillEntry = {
	/** One-liner shown in the system prompt so the model knows when to load it. */
	description: string;
	load: () => Promise<string>;
};

export const SKILLS: Record<SkillSlug, SkillEntry> = {
	"landing-page-design": {
		description:
			"The design constitution for landing pages and small business sites: aesthetic-direction ritual, variation axes, anti-slop ban list, craft rules, the Algeria conversion layer (RTL/AR+FR, COD form, WhatsApp trust), and self-review gates. MUST be read before giving any design direction or page-structure advice.",
		load: () =>
			readFile(new URL("./landing-page-design.md", import.meta.url), "utf8"),
	},
};
