import { streamText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runArtDirection } from "./art-director-agent";
import {
	buildArtDirectorExtractionSystemPrompt,
	buildArtDirectorSystemPrompt,
} from "./art-director-prompt";
import { createCreativeSpecFixture } from "./creative-spec.fixture";

vi.mock("ai", async (importOriginal) => {
	const original = await importOriginal<typeof import("ai")>();

	return { ...original, streamText: vi.fn() };
});

/**
 * runArtDirection drains fullStream before awaiting text/output, so a fake
 * result needs all three. Parts let a test inject {type:"error"} failures.
 */
function fakeStreamResult(config: {
	output?: unknown;
	parts?: Array<{ error?: unknown; type: string }>;
	text?: string;
}) {
	const parts = config.parts ?? [];

	return {
		fullStream: (async function* () {
			yield* parts;
		})(),
		output: Promise.resolve(config.output),
		text: Promise.resolve(config.text ?? ""),
	} as never;
}

beforeEach(() => {
	vi.mocked(streamText).mockReset();
});

describe("runArtDirection", () => {
	it("creates a plain-text Capsule before extracting the structured spec", async () => {
		const spec = createCreativeSpecFixture();
		const capsule =
			"## 1. Concept & Philosophy\n\nQuiet Calibration\n\n## 2. Vibe & Copy Voice\n\nCalm.";
		const abortController = new AbortController();
		vi.mocked(streamText)
			.mockReturnValueOnce(fakeStreamResult({ text: capsule }))
			.mockReturnValueOnce(fakeStreamResult({ output: spec }));

		const output = await runArtDirection({
			abortSignal: abortController.signal,
			contentBrief: "A calm dental clinic with online booking.",
			extractionSystem: "Spec extraction system prompt",
			model: "test-provider/art-director",
			system: "Art Director system prompt",
			title: "Clinic",
		});

		expect(output).toEqual({ capsule, spec });
		expect(streamText).toHaveBeenCalledTimes(2);
		expect(streamText).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				abortSignal: abortController.signal,
				instructions: "Art Director system prompt",
				maxOutputTokens: 32_000,
				model: "test-provider/art-director",
				prompt: expect.stringContaining("A calm dental clinic"),
			}),
		);
		expect(vi.mocked(streamText).mock.calls[0]?.[0]).not.toHaveProperty(
			"output",
		);
		expect(streamText).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				abortSignal: abortController.signal,
				instructions: "Spec extraction system prompt",
				maxOutputTokens: 24_000,
				model: "test-provider/art-director",
				output: expect.any(Object),
				prompt: expect.stringContaining(
					`"creativeCapsule":${JSON.stringify(capsule)}`,
				),
			}),
		);
	});

	it("rethrows a mid-stream error part instead of trusting partial text", async () => {
		vi.mocked(streamText).mockReturnValueOnce(
			fakeStreamResult({
				parts: [
					{ type: "text-delta" },
					{ error: new Error("socket closed"), type: "error" },
				],
				text: "half a capsule",
			}),
		);

		await expect(
			runArtDirection({
				contentBrief: "Clinic brief",
				extractionSystem: "Spec extraction system prompt",
				model: "test-provider/art-director",
				system: "Art Director system prompt",
				title: "Clinic",
			}),
		).rejects.toThrow(
			/Art Director failed to produce a Creative Capsule: socket closed/,
		);
		expect(streamText).toHaveBeenCalledTimes(1);
	});

	it("returns a clear stage-specific error for an invalid semantic handoff", async () => {
		const spec = createCreativeSpecFixture();
		const secondSection = spec.page.sections[1];

		if (!secondSection) {
			throw new Error("fixture must include a second section");
		}

		secondSection.semanticId =
			spec.page.sections[0]?.semanticId ?? "treatments";
		vi.mocked(streamText)
			.mockReturnValueOnce(
				fakeStreamResult({ text: "Complete Creative Capsule" }),
			)
			.mockReturnValueOnce(fakeStreamResult({ output: spec }));

		await expect(
			runArtDirection({
				contentBrief: "Clinic brief",
				extractionSystem: "Spec extraction system prompt",
				model: "test-provider/art-director",
				system: "Art Director system prompt",
				title: "Clinic",
			}),
		).rejects.toThrow(
			/Art Director failed to produce a valid CreativeSpec: CreativeSpec contains duplicate/,
		);
	});

	it("does not attempt extraction when Creative Direction returns no Capsule", async () => {
		vi.mocked(streamText).mockReturnValueOnce(
			fakeStreamResult({ text: " \n " }),
		);

		await expect(
			runArtDirection({
				contentBrief: "Clinic brief",
				extractionSystem: "Spec extraction system prompt",
				model: "test-provider/art-director",
				system: "Art Director system prompt",
				title: "Clinic",
			}),
		).rejects.toThrow(
			/Art Director failed to produce a Creative Capsule: The model returned an empty/,
		);
		expect(streamText).toHaveBeenCalledTimes(1);
	});
});

describe("Art Director prompts", () => {
	it("requires the fixed Capsule sections, binding rule, and exemplar mechanics", () => {
		const prompt = buildArtDirectorSystemPrompt();
		const requiredSections = [
			"Concept & Philosophy",
			"Vibe & Copy Voice",
			"Tokens",
			"Opening Architecture & Silhouette",
			"Page Spine & Scenes",
			"Signature Moves",
			"Component Physics",
			"Motion System",
			"Media Plan",
			"Mobile Recomposition",
			"Anti-Patterns",
			"Bold Factor",
			"Builder Contract",
		];

		requiredSections.forEach((section, index) => {
			expect(prompt).toContain(`## ${index + 1}. ${section}`);
		});
		expect(prompt).toContain(
			"Every design adjective must be chained to an observable value in the same breath",
		);
		expect(prompt).toContain("Opt-in pinned horizontal gallery");
		expect(prompt).toContain("Runtime masked line split");
		expect(prompt).toContain("Generative Canvas2D exhibit");
		expect(prompt).toContain("Data-attribute colorway engine");
		expect(prompt).toContain("JS-only entrance hiding");
		expect(prompt).toContain(
			"vocabulary to compose from and exceed, never a checklist",
		);
	});

	it("keeps extraction faithful, minimal, and protected from untrusted input", () => {
		const prompt = buildArtDirectorExtractionSystemPrompt();

		expect(prompt).toContain("untrusted source material");
		expect(prompt).toContain("Do not ideate a new route");
		expect(prompt).toContain(
			"resolve that field minimally and consistently from the Capsule",
		);
		expect(prompt).toContain("empty generatedShots array");
	});
});
