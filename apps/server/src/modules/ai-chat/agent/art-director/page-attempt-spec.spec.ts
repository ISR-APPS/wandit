import { describe, expect, it } from "vitest";

import { createCreativeSpecFixture } from "./creative-spec.fixture";
import { pageAttemptSpecSchema } from "./page-attempt-spec";

describe("pageAttemptSpecSchema", () => {
	it("accepts a queued V2 attempt before and after Art Direction", () => {
		const queued = {
			artDirectorExtractionSystemPrompt: "Spec extraction prompt",
			artDirectorModel: "test-provider/art-director",
			artDirectorSystemPrompt: "Art Director prompt",
			brief: "Complete factual content brief",
			designerSystemPrompt: "Builder prompt",
			title: "Test page",
			version: 2 as const,
		};

		expect(pageAttemptSpecSchema.parse(queued)).toEqual(queued);
		expect(
			pageAttemptSpecSchema.parse({
				...queued,
				creativeCapsule: "# Creative Capsule\n\nSpecific design language",
				creativeSpec: createCreativeSpecFixture(),
			}),
		).toMatchObject({ version: 2 });
	});

	it("accepts V2 attempts queued before capsule extraction was snapshotted", () => {
		const previousV2 = {
			artDirectorModel: "test-provider/art-director",
			artDirectorSystemPrompt: "Old one-stage Art Director prompt",
			brief: "Complete factual content brief",
			creativeSpec: createCreativeSpecFixture(),
			designerSystemPrompt: "Builder prompt",
			title: "Test page",
			version: 2 as const,
		};

		expect(pageAttemptSpecSchema.parse(previousV2)).toEqual(previousV2);
	});

	it("accepts legacy combined-brief attempts", () => {
		const legacy = {
			brief: "Old combined factual and creative brief",
			designerSystemPrompt: "Old Builder prompt",
			title: "Legacy page",
		};

		expect(pageAttemptSpecSchema.parse(legacy)).toEqual(legacy);
	});

	it("rejects an incomplete V2 snapshot", () => {
		expect(() =>
			pageAttemptSpecSchema.parse({
				brief: "Missing Art Director model and prompts",
				designerSystemPrompt: "Builder prompt",
				title: "Broken page",
				version: 2,
			}),
		).toThrow();
	});
});
