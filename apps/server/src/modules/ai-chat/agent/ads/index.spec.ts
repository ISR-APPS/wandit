import { skillSlugSchema } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	ADS_SKILL_SLUGS,
	ADS_SKILLS,
	composeAdsBlock,
	isAdsSkillSlug,
} from "./index";

const noTracking = {
	metaPixelSet: false,
	published: false,
	tiktokPixelSet: false,
};

describe("ads skill registry", () => {
	it("registers the six referential skills, each with a real playbook", () => {
		expect(ADS_SKILL_SLUGS).toEqual([
			"ads-fundamentals",
			"ads-creative",
			"ads-audiences",
			"ads-measurement",
			"ads-cod-maghreb",
			"ads-diagnostic",
		]);

		for (const slug of ADS_SKILL_SLUGS) {
			const skill = ADS_SKILLS[slug];
			expect(skill.slug).toBe(slug);
			expect(skill.title.length).toBeGreaterThan(3);
			expect(skill.description.length).toBeGreaterThan(60);
			// A playbook, not a stub — and not a whole book either: it is read
			// mid-loop and must fit comfortably beside the system prompt.
			expect(skill.doc.length).toBeGreaterThan(6_000);
			expect(skill.doc.length).toBeLessThan(20_000);
			expect(skill.doc.trimStart().startsWith("# ADS SKILL")).toBe(true);
		}
	});

	it("emits plain prompt prose without template-literal syntax", () => {
		for (const slug of ADS_SKILL_SLUGS) {
			expect(ADS_SKILLS[slug].doc).not.toContain("`");
			expect(ADS_SKILLS[slug].doc).not.toContain("${");
		}
	});

	it("keeps the contract enum and the registry in sync (chips, read_skill, history)", () => {
		for (const slug of ADS_SKILL_SLUGS) {
			expect(skillSlugSchema.options).toContain(slug);
		}
		expect(isAdsSkillSlug("ads-diagnostic")).toBe(true);
		expect(isAdsSkillSlug("landing-page-design")).toBe(false);
		expect(isAdsSkillSlug("seo-review")).toBe(false);
	});
});

describe("composeAdsBlock", () => {
	it("returns null when the request has nothing to do with ads", () => {
		expect(
			composeAdsBlock({
				connectedSlugs: ["higgsfield"],
				selectedSkills: ["seo-review"],
				tracking: noTracking,
			}),
		).toBeNull();
		expect(
			composeAdsBlock({
				connectedSlugs: [],
				selectedSkills: [],
				tracking: null,
			}),
		).toBeNull();
	});

	it("names the connected platforms, the tracking facts, and the skill index", () => {
		const block = composeAdsBlock({
			connectedSlugs: ["tiktok-ads", "meta-ads", "higgsfield"],
			selectedSkills: [],
			tracking: { metaPixelSet: true, published: false, tiktokPixelSet: false },
		});

		expect(block).toContain("Connected ad platforms: TikTok Ads, Meta Ads");
		expect(block).toContain("Meta pixel id set: yes");
		expect(block).toContain("TikTok pixel id set: no");
		expect(block).toContain("page published: no");
		expect(block).toContain("read_skill");
		for (const slug of ADS_SKILL_SLUGS) {
			expect(block).toContain(`  - ${slug}: `);
		}
		// The playbooks themselves do not travel unless selected.
		expect(block).not.toContain("# ADS SKILL");
	});

	it("says plainly when no ad platform is connected but a skill was picked", () => {
		const block = composeAdsBlock({
			connectedSlugs: [],
			selectedSkills: ["ads-creative"],
			tracking: null,
		});

		expect(block).toContain("No ad platform is connected");
		expect(block).not.toContain("Tracking facts");
		expect(block).toContain(
			"Skills the user selected for this message: ads-creative",
		);
		expect(block).toContain(ADS_SKILLS["ads-creative"].doc.trim());
	});

	it("inlines at most two selected playbooks and points the rest to read_skill", () => {
		const block = composeAdsBlock({
			connectedSlugs: ["meta-ads"],
			selectedSkills: ["ads-measurement", "ads-creative", "ads-fundamentals"],
			tracking: noTracking,
		});

		expect(block).toContain(
			"Skills the user selected for this message: ads-fundamentals, ads-creative, ads-measurement.",
		);
		expect(block).toContain("--- ads-fundamentals ---");
		expect(block).toContain("--- ads-creative ---");
		expect(block).not.toContain("--- ads-measurement ---");
		expect(block).toContain("Load ads-measurement through read_skill");
	});

	it("injects selected skills once, in registry order, ignoring unknown ids", () => {
		const block = composeAdsBlock({
			connectedSlugs: ["meta-ads"],
			selectedSkills: [
				"ads-diagnostic",
				"brand-voice",
				"ads-fundamentals",
				"ads-diagnostic",
			],
			tracking: noTracking,
		});

		expect(block).toContain(
			"Skills the user selected for this message: ads-fundamentals, ads-diagnostic",
		);
		expect(block?.split("--- ads-diagnostic ---")).toHaveLength(2);
		expect(block?.indexOf("--- ads-fundamentals ---")).toBeLessThan(
			block?.indexOf("--- ads-diagnostic ---") ?? -1,
		);
		expect(block).not.toContain("brand-voice");
	});
});
