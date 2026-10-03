import { deploymentSlugSchema } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { SlugTakenError } from "./errors/site.errors";
import { pickFreeSlug, slugifyProjectName, withRandomSuffix } from "./slugify";

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
		const result = withRandomSuffix("smoke-project");

		expect(result).toMatch(/^smoke-project-[a-z0-9]{4}$/);
		expect(deploymentSlugSchema.safeParse(result).success).toBe(true);
	});

	it("keeps long bases within 63 chars", () => {
		const result = withRandomSuffix("a".repeat(63));

		expect(result.length).toBeLessThanOrEqual(63);
		expect(deploymentSlugSchema.safeParse(result).success).toBe(true);
	});
});

describe("pickFreeSlug", () => {
	it("answers the name slug when no other live site has it", async () => {
		await expect(
			pickFreeSlug("Smoke Project", async () => false),
		).resolves.toBe("smoke-project");
	});

	it("adds a random suffix when the name slug is taken", async () => {
		const taken = new Set(["smoke-project"]);

		const slug = await pickFreeSlug("Smoke Project", async (candidate) =>
			taken.has(candidate),
		);

		expect(slug).toMatch(/^smoke-project-[a-z0-9]{4}$/);
	});

	it("throws SlugTakenError after five taken candidates", async () => {
		const isTaken = vi.fn(async () => true);

		await expect(pickFreeSlug("Smoke Project", isTaken)).rejects.toBeInstanceOf(
			SlugTakenError,
		);
		expect(isTaken).toHaveBeenCalledTimes(5);
	});
});
