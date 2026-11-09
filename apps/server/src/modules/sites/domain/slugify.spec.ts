import { deploymentSlugSchema } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { SlugTakenError } from "./errors/site.errors";
import {
	pickFreeSlug,
	slugForRequest,
	slugifyProjectName,
	withRandomSuffix,
} from "./slugify";

describe("slugifyProjectName", () => {
	it("lowercases and hyphenates", () => {
		expect(slugifyProjectName("Smoke Project")).toBe("smoke-project");
	});

	it("strips accents", () => {
		expect(slugifyProjectName("Café à Alger")).toBe("cafe-a-alger");
	});

	it("collapses punctuation runs and trims hyphens", () => {
		expect(slugifyProjectName("  --Wow!! (v2)__ ")).toBe("wow-v2");
	});

	it("falls back for names with no usable characters", () => {
		expect(slugifyProjectName("☕☕☕")).toBe("site");
	});

	it("caps at 63 chars and never ends with a hyphen", () => {
		const slug = slugifyProjectName(`${"a".repeat(62)}-b`);

		expect(slug.length).toBeLessThanOrEqual(63);
		expect(slug.endsWith("-")).toBe(false);
	});

	it("always satisfies the contract regex", () => {
		for (const name of [
			"Smoke Project",
			"éàü",
			"UPPER",
			"123 go",
			"x",
			"a b c d e f g h i j k l m n o p q r s t u v w x y z 0 1 2 3 4 5",
		]) {
			expect(
				deploymentSlugSchema.safeParse(slugifyProjectName(name)).success,
			).toBe(true);
		}
	});
});

describe("withRandomSuffix", () => {
	it("appends a 4-char suffix and stays a valid slug", () => {
		const result = withRandomSuffix("smoke-project", undefined);

		expect(result).toMatch(/^smoke-project-[a-z0-9]{4}$/);
		expect(deploymentSlugSchema.safeParse(result).success).toBe(true);
	});

	it("keeps long bases within 63 chars", () => {
		const result = withRandomSuffix("a".repeat(63), undefined);

		expect(result.length).toBeLessThanOrEqual(63);
		expect(deploymentSlugSchema.safeParse(result).success).toBe(true);
	});
});

describe("pickFreeSlug", () => {
	it("answers the name slug when no other live site has it", async () => {
		await expect(
			pickFreeSlug("Smoke Project", async () => false, undefined),
		).resolves.toBe("smoke-project");
	});

	it("adds a random suffix when the name slug is taken", async () => {
		const taken = new Set(["smoke-project"]);

		const slug = await pickFreeSlug(
			"Smoke Project",
			async (candidate) => taken.has(candidate),
			undefined,
		);

		expect(slug).toMatch(/^smoke-project-[a-z0-9]{4}$/);
	});

	// The staging edge route takes every "*-stg.wandit.app" host.
	it("adds a random part to a production name slug that ends with -stg", async () => {
		const slug = await pickFreeSlug("Shop STG", async () => false, undefined);

		expect(slug).toMatch(/^shop-stg-[a-z0-9]{4}$/);
	});

	it("ends a staging slug with -stg, also after a collision", async () => {
		const taken = new Set(["smoke-project-stg"]);

		const slug = await pickFreeSlug(
			"Smoke Project",
			async (candidate) => taken.has(candidate),
			"-stg",
		);

		expect(slug).toMatch(/^smoke-project-[a-z0-9]{4}-stg$/);
	});

	it("keeps a long staging slug within 63 chars with its random part", async () => {
		const slug = await pickFreeSlug(
			"a".repeat(70),
			async (candidate) => candidate === `${"a".repeat(59)}-stg`,
			"-stg",
		);

		expect(slug).toMatch(/^a+-[a-z0-9]{4}-stg$/);
		expect(slug.length).toBeLessThanOrEqual(63);
		expect(deploymentSlugSchema.safeParse(slug).success).toBe(true);
	});

	it("throws SlugTakenError after five taken candidates", async () => {
		const isTaken = vi.fn(async () => true);

		await expect(
			pickFreeSlug("Smoke Project", isTaken, undefined),
		).rejects.toBeInstanceOf(SlugTakenError);
		expect(isTaken).toHaveBeenCalledTimes(5);
	});
});

describe("slugForRequest", () => {
	it.each([
		["production keeps a normal slug", "shop", undefined, "shop"],
		["production refuses the staging ending", "shop-stg", undefined, null],
		["staging adds the ending", "shop", "-stg", "shop-stg"],
		["staging keeps an existing ending", "shop-stg", "-stg", "shop-stg"],
		[
			"staging cuts a long slug to 63 chars",
			"a".repeat(63),
			"-stg",
			`${"a".repeat(59)}-stg`,
		],
	] as const)("%s", (_name, slug, suffix, expected) => {
		expect(slugForRequest(slug, suffix)).toBe(expected);
	});
});
