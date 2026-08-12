import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { canAutostartStashedPrompt, promptStash } from "./prompt-stash";

function installSessionStorage() {
	const values = new Map<string, string>();
	vi.stubGlobal("window", {
		sessionStorage: {
			getItem: (key: string) => values.get(key) ?? null,
			removeItem: (key: string) => {
				values.delete(key);
			},
			setItem: (key: string, value: string) => {
				values.set(key, value);
			},
		},
	});
	return values;
}

beforeEach(() => {
	installSessionStorage();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("canAutostartStashedPrompt", () => {
	it("starts a non-empty text prompt", () => {
		expect(
			canAutostartStashedPrompt({
				prompt: "  Build a COD landing page for my shop  ",
			}),
		).toBe(true);
	});

	it("starts a page-mode composer with a prompt", () => {
		expect(
			canAutostartStashedPrompt({
				composer: { mode: "page", output: "landing-page", quality: "standard" },
				prompt: "A vitrine for a florist in Algiers",
			}),
		).toBe(true);
	});

	it("does not start an empty prompt", () => {
		expect(canAutostartStashedPrompt({ prompt: "   " })).toBe(false);
	});

	it("does not start image-animation without a source still", () => {
		expect(
			canAutostartStashedPrompt({
				composer: {
					mode: "video",
					options: { motion: "subtle" },
					output: "image-animation",
					quality: "standard",
				},
				prompt: "Make this product photo move",
			}),
		).toBe(false);
	});

	it("starts image-animation when a source still survived", () => {
		expect(
			canAutostartStashedPrompt({
				composer: {
					mode: "video",
					options: {
						sourceImageUrl: "https://cdn.example/still.webp",
					},
					output: "image-animation",
					quality: "standard",
				},
				prompt: "Make this product photo move",
			}),
		).toBe(true);
	});
});

describe("promptStash", () => {
	it("round-trips a prompt and composer once", () => {
		promptStash.stash("Build a watch shop page", {
			mode: "page",
			output: "landing-page",
			quality: "max",
		});

		expect(promptStash.consume()).toEqual({
			composer: {
				mode: "page",
				output: "landing-page",
				quality: "max",
			},
			prompt: "Build a watch shop page",
		});
		expect(promptStash.consume()).toBeNull();
	});

	it("keeps a plain-text pre-v2 stash", () => {
		window.sessionStorage.setItem("wandit-prompt-stash", "Old draft prompt");

		expect(promptStash.consume()).toEqual({ prompt: "Old draft prompt" });
	});
});
