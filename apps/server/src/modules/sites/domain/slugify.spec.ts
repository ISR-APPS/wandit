import { deploymentSlugSchema } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { slugifyProjectName, withRandomSuffix } from "./slugify";

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
