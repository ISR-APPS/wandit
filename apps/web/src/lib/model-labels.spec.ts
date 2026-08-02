import { describe, expect, it } from "vitest";

import {
	BUILDER_MODELS,
	DEFAULT_BUILDER_MODEL,
	getModelLabel,
} from "./model-labels";

describe("getModelLabel", () => {
	it.each([
		["xai/grok-4.5", "Grok 4.5"],
		["google/gemini-3.1-pro-preview", "Gemini 3.1 Pro"],
		["openai/gpt-5.6-luna", "GPT-5.6 Luna"],
		["openai/gpt-5.6-terra", "GPT-5.6 Terra"],
		["openai/gpt-5.6-sol", "GPT-5.6 Sol"],
	])("labels %s as %s", (modelId, label) => {
		expect(getModelLabel(modelId)).toBe(label);
	});

	it("removes the vendor prefix from unknown gateway ids", () => {
		expect(getModelLabel("vendor/new-model/version-2")).toBe(
			"new-model/version-2",
		);
	});

	it("keeps an unknown id that has no vendor prefix", () => {
		expect(getModelLabel("local-model")).toBe("local-model");
	});

	it("uses the shared labels for every explicit builder picker option", () => {
		for (const option of BUILDER_MODELS) {
			if (option === DEFAULT_BUILDER_MODEL) continue;
			expect(option.label).toBe(getModelLabel(option.gatewayModelId));
		}
	});
});
