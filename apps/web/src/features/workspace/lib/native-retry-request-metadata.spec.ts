import { describe, expect, it } from "vitest";

import { findRetryRequestMetadata } from "../../../../../native/features/workspace/lib/retry-request-metadata";

describe("native retry request metadata", () => {
	it("restores composer and target ids after an app restart", () => {
		const composer = {
			mode: "video" as const,
			output: "video-creator",
			options: { builderModel: "anthropic/claude-sonnet-4.5" },
		};
		const messages = [
			{
				id: "user-1",
				role: "user",
				metadata: { composer, selectedWids: ["hero", "cta"] },
			},
			{ id: "assistant-failed", role: "assistant" },
		];

		expect(findRetryRequestMetadata(messages, "assistant-failed")).toEqual({
			composer,
			selectedWids: ["hero", "cta"],
		});
	});

	it("derives target ids from legacy display snapshots", () => {
		const messages = [
			{
				id: "user-legacy",
				role: "user",
				metadata: {
					selectedTargets: [
						{ wid: "hero", tag: "section", excerpt: null },
						{ wid: "cta", tag: "button", excerpt: null },
					],
				},
			},
			{ id: "assistant-failed", role: "assistant" },
		];

		expect(findRetryRequestMetadata(messages, "assistant-failed")).toEqual({
			selectedWids: ["hero", "cta"],
		});
	});
});
