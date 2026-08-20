import { ADS_AUDIENCES_DOC } from "./audiences";
import { ADS_COD_MAGHREB_DOC } from "./cod-maghreb";
import { ADS_CREATIVE_DOC } from "./creative";
import { ADS_DIAGNOSTIC_DOC } from "./diagnostic";
import { ADS_FUNDAMENTALS_DOC } from "./fundamentals";
import { ADS_MEASUREMENT_DOC } from "./measurement";

/**
 * Ads skills — the media-buying method of the brain.
 *
 * Six playbooks written from the Wandit media-buying referential (August
 * 2026). They are TypeScript constants, never .md files: the production
 * tsdown bundle carries no markdown assets, and every other live knowledge
 * document in this module (COD_GENRE_DOC, SIMPLE_COD_STYLE_DOC,
 * FRONTEND_DESIGN_SKILL) already follows that rule.
 *
 * Three layers keep every ordinary message cheap and the ads knowledge deep:
 *
 * 1. The static system prompt carries only the method spine ("## Ads
 *    method" in system-prompt.ts) — a few lines, always on.
 * 2. composeAdsBlock() appends a short per-request block when an ads
 *    connector is connected or the user picked ads skills in the composer:
 *    connected platforms, the project's tracking facts, and the skill index.
 * 3. The full playbooks load on demand through the read_skill tool (the
 *    model pulls the one the task needs) or inline when the user selected
 *    the skill chip for this message. Old skill outputs are elided from the
 *    model-bound history by ai-chat.service.ts, so a load costs ~0 later.
 */
export const ADS_SKILL_SLUGS = [
	"ads-fundamentals",
	"ads-creative",
	"ads-audiences",
	"ads-measurement",
	"ads-cod-maghreb",
	"ads-diagnostic",
] as const;

export type AdsSkillSlug = (typeof ADS_SKILL_SLUGS)[number];

export type AdsSkill = {
	/** One line shown in the skill index so the model knows when to load it. */
	description: string;
	/** The full playbook — plain prompt prose, no template-literal syntax. */
	doc: string;
	slug: AdsSkillSlug;
	title: string;
};

export const ADS_SKILLS: Record<AdsSkillSlug, AdsSkill> = {
	"ads-audiences": {
		description:
			"Prospecting broad-first, the retargeting warmth ladder (3/7/14/30/90/180 days), video and engager audiences, lookalikes and seed quality, mandatory exclusions, overlap, customer files in a phone-first market. Load for any targeting or retargeting question.",
		doc: ADS_AUDIENCES_DOC,
		slug: "ads-audiences",
		title: "Audiences",
	},
	"ads-cod-maghreb": {
		description:
			"COD economics (cost per DELIVERED order, confirmation / delivery / return rates), junk traffic, WhatsApp campaigns, no-card tracking, darija/FR/AR message match, Ramadan and local seasonality, wilaya delivery reality, COD offer and post-click maths. Load for any Maghreb or COD merchant.",
		doc: ADS_COD_MAGHREB_DOC,
		slug: "ads-cod-maghreb",
		title: "COD Maghreb",
	},
	"ads-creative": {
		description:
			"Hook rate, hold rate, retention, CTR outbound vs all, fatigue signals, creative velocity, modular testing (hook / body / proof / CTA), first-3-seconds engineering, angle sources, format win conditions, what to brief to Wandit's generators. Load for any creative, ad copy, or video-ad question.",
		doc: ADS_CREATIVE_DOC,
		slug: "ads-creative",
		title: "Creative",
	},
	"ads-diagnostic": {
		description:
			"THE method: expert restraint (72 h / 3x target CPA), tracking-first diagnostic order, the symptom -> cause -> test -> action tree, seven playbooks (CPM spike, CTR drop, CVR collapse, ROAS drop after a raise, learning limited, platform vs Leads-tab gap, budget not spending), policy pre-flight that informs but never forbids, recommendation tone. Load FIRST for any 'why is it not working', review, or change request.",
		doc: ADS_DIAGNOSTIC_DOC,
		slug: "ads-diagnostic",
		title: "Diagnostic",
	},
	"ads-fundamentals": {
		description:
			"Unit economics vocabulary, campaign / ad set / ad structure, CBO vs ABO and the 2026 Advantage+ / Smart+ shift, learning phase and the edits that reset it, bid strategies, scaling (+20-30 % per 48 h), delivery diagnostics, kill criteria, breakdowns without over-segmenting. Load for any account-structure, budget, bidding, or scaling question.",
		doc: ADS_FUNDAMENTALS_DOC,
		slug: "ads-fundamentals",
		title: "Fundamentals",
	},
	"ads-measurement": {
		description:
			"Attribution windows, MER vs platform ROAS, incrementality, CAPI / EMQ, UTM and the Leads tab as backend truth, statistics (sample size, peeking, regression to the mean), media finance (contribution margin, break-even and MARGINAL ROAS, payback, stock), cross-platform allocation. Load before any ROAS, CPA, profitability, or attribution claim.",
		doc: ADS_MEASUREMENT_DOC,
		slug: "ads-measurement",
		title: "Measurement",
	},
};

export function isAdsSkillSlug(value: string): value is AdsSkillSlug {
	return Object.hasOwn(ADS_SKILLS, value);
}

/** Connector slugs that make a chat an "ads" chat. */
export const ADS_CONNECTOR_SLUGS = new Set(["meta-ads", "tiktok-ads"]);

const ADS_CONNECTOR_LABELS: Record<string, string> = {
	"meta-ads": "Meta Ads",
	"tiktok-ads": "TikTok Ads",
};

/** Wandit-side tracking facts for the chat's project (zero tool calls). */
export type AdsTrackingFacts = {
	metaPixelSet: boolean;
	published: boolean;
	tiktokPixelSet: boolean;
};

export type ComposeAdsBlockInput = {
	/** Connector slugs that resolved at least one tool for this request. */
	connectedSlugs: readonly string[];
	/** Raw composer.skills ids from the prompt box; unknown ids are ignored. */
	selectedSkills: readonly string[];
	/** null when the project lookup failed — the block then says nothing about tracking. */
	tracking: AdsTrackingFacts | null;
};

const yesNo = (value: boolean) => (value ? "yes" : "no");

/** How many selected playbooks travel inline per message. */
export const MAX_INLINE_SKILLS = 2;

/**
 * The per-request ads block appended after the MCP notices, or null when the
 * request has nothing to do with ads (no ads connector, no ads skill picked).
 *
 * Deliberately short: the platforms, three tracking facts, and the skill
 * index. The playbooks themselves only travel when the user picked them for
 * this message — the model loads everything else through read_skill.
 */
export function composeAdsBlock(input: ComposeAdsBlockInput): string | null {
	const connected = input.connectedSlugs.filter((slug) =>
		ADS_CONNECTOR_SLUGS.has(slug),
	);
	const selected = uniqueAdsSlugs(input.selectedSkills);

	if (connected.length === 0 && selected.length === 0) {
		return null;
	}

	const lines: string[] = ["Ads context for THIS request:"];

	if (connected.length > 0) {
		lines.push(
			`- Connected ad platforms: ${connected
				.map((slug) => ADS_CONNECTOR_LABELS[slug] ?? slug)
				.join(
					", ",
				)}. Reads and build steps (paused creates, uploads, edits, pausing, enabling single ads) run automatically; only launching delivery at the campaign / ad set level, budget or bid changes on existing entities, and deletes pause for the user's confirmation.`,
		);
	} else {
		lines.push(
			"- No ad platform is connected in this workspace. You can teach, plan, and review, but you cannot read or change campaigns — when the user asks for an ads action, say so plainly and point them to Settings → Connectors. Never pretend a platform action happened.",
		);
	}

	if (input.tracking) {
		lines.push(
			"- Tracking facts for this project (Wandit side, authoritative): " +
				`Meta pixel id set: ${yesNo(input.tracking.metaPixelSet)}; ` +
				`TikTok pixel id set: ${yesNo(input.tracking.tiktokPixelSet)}; ` +
				`page published: ${yesNo(input.tracking.published)}. ` +
				"A pixel that is not set cannot fire, and an unpublished page cannot convert — check these before interpreting any platform number.",
		);
	}

	lines.push(
		"- Ads playbooks available through read_skill (load the matching one BEFORE advising, planning, reviewing, or changing anything ads-related; ads-diagnostic first for any underperformance question; at most two per turn):",
	);

	for (const slug of ADS_SKILL_SLUGS) {
		lines.push(`  - ${slug}: ${ADS_SKILLS[slug].description}`);
	}

	if (selected.length > 0) {
		// Inline at most two playbooks (~14 KB each): beyond that the prompt
		// balloons for little gain — the rest stay one read_skill call away.
		const inlined = selected.slice(0, MAX_INLINE_SKILLS);
		const deferred = selected.slice(MAX_INLINE_SKILLS);

		lines.push(
			`- Skills the user selected for this message: ${selected.join(", ")}. ` +
				`The full text of ${inlined.join(" and ")} follows — apply it now, no need to call read_skill for ${inlined.length > 1 ? "them" : "it"}.` +
				(deferred.length > 0
					? ` Load ${deferred.join(", ")} through read_skill when the task needs ${deferred.length > 1 ? "them" : "it"}.`
					: ""),
		);

		for (const slug of inlined) {
			lines.push("", `--- ${slug} ---`, ADS_SKILLS[slug].doc.trim());
		}
	}

	return lines.join("\n");
}

function uniqueAdsSlugs(values: readonly string[]): AdsSkillSlug[] {
	const seen = new Set<AdsSkillSlug>();

	for (const value of values) {
		if (isAdsSkillSlug(value)) {
			seen.add(value);
		}
	}

	// Stable order: the registry order, not the click order.
	return ADS_SKILL_SLUGS.filter((slug) => seen.has(slug));
}
