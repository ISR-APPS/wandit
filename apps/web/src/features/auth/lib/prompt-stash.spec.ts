import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	AUTOSTART_TTL_MS,
	canAutostartStashedPrompt,
	promptStash,
} from "./prompt-stash";

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

const NOW = 1_700_000_000_000;

describe("canAutostartStashedPrompt", () => {
	it("starts a fresh draft the stash marked eligible", () => {
		expect(
			canAutostartStashedPrompt(
				{
					autostart: true,
					prompt: "  Build a COD landing page for my shop  ",
					stashedAt: NOW - 1_000,
				},
				NOW,
			),
		).toBe(true);
	});

	it("never starts a draft the stash marked prefill-only", () => {
		expect(
			canAutostartStashedPrompt(
				{
					autostart: false,
					composer: {
						mode: "page",
						output: "landing-page",
					},
					prompt: "A vitrine for a florist in Algiers",
					stashedAt: NOW - 1_000,
				},
				NOW,
			),
		).toBe(false);
	});

	it("does not start an empty prompt", () => {
		expect(
			canAutostartStashedPrompt(
				{ autostart: true, prompt: "   ", stashedAt: NOW - 1_000 },
				NOW,
			),
		).toBe(false);
	});

	it("downgrades a stale draft to prefill after the TTL", () => {
		expect(
			canAutostartStashedPrompt(
				{
					autostart: true,
					prompt: "Build a watch shop page",
					stashedAt: NOW - AUTOSTART_TTL_MS - 1,
				},
				NOW,
			),
		).toBe(false);
	});

	it("never starts a draft without a stash timestamp", () => {
		expect(
			canAutostartStashedPrompt(
				{ autostart: true, prompt: "Old draft prompt", stashedAt: 0 },
				NOW,
			),
		).toBe(false);
	});

	it.each([
		NOW + 60_000,
		Number.POSITIVE_INFINITY,
		Number.NaN,
	])("never trusts a future or non-finite timestamp (%s)", (stashedAt) => {
		expect(
			canAutostartStashedPrompt(
				{ autostart: true, prompt: "Build a watch shop page", stashedAt },
				NOW,
			),
		).toBe(false);
	});
});

describe("promptStash", () => {
	it("round-trips a prompt, composer, and autostart flag once", () => {
		promptStash.stash(
			"Build a watch shop page",
			{
				mode: "page",
				output: "landing-page",
			},
			{ autostart: true },
		);

		const draft = promptStash.consume();
		expect(draft).toMatchObject({
			autostart: true,
			composer: {
				mode: "page",
				output: "landing-page",
			},
			prompt: "Build a watch shop page",
		});
		expect(draft?.stashedAt).toBeGreaterThan(0);
		expect(promptStash.consume()).toBeNull();
	});

	it("defaults to prefill-only when no autostart flag is recorded", () => {
		promptStash.stash("Build a watch shop page");

		expect(promptStash.consume()).toMatchObject({
			autostart: false,
			prompt: "Build a watch shop page",
		});
	});

	it("keeps a plain-text pre-v2 stash as prefill-only", () => {
		window.sessionStorage.setItem("wandit-prompt-stash", "Old draft prompt");

		expect(promptStash.consume()).toEqual({
			autostart: false,
			composer: undefined,
			prompt: "Old draft prompt",
			stashedAt: 0,
		});
	});

	it("keeps a v2 stash's text and composer but strips its autostart right", () => {
		window.sessionStorage.setItem(
			"wandit-prompt-stash",
			JSON.stringify({
				composer: { mode: "page", output: "landing-page" },
				prompt: "Build a watch shop page",
				version: 2,
			}),
		);

		expect(promptStash.consume()).toEqual({
			autostart: false,
			composer: { mode: "page", output: "landing-page" },
			prompt: "Build a watch shop page",
			stashedAt: 0,
		});
	});

	it("restores a legacy composer while dropping its quality key", () => {
		window.sessionStorage.setItem(
			"wandit-prompt-stash",
			JSON.stringify({
				autostart: true,
				composer: {
					mode: "page",
					options: { audience: "founders" },
					output: "landing-page",
					quality: "max",
					skills: ["brand-copy"],
				},
				prompt: "Build a watch shop page",
				stashedAt: NOW,
				version: 3,
			}),
		);

		expect(promptStash.consume()).toEqual({
			autostart: true,
			composer: {
				mode: "page",
				options: { audience: "founders" },
				output: "landing-page",
				skills: ["brand-copy"],
			},
			prompt: "Build a watch shop page",
			stashedAt: NOW,
		});
	});

	it("strips the autostart right from a future-version stash", () => {
		window.sessionStorage.setItem(
			"wandit-prompt-stash",
			JSON.stringify({
				autostart: true,
				prompt: "Build a watch shop page",
				stashedAt: Date.now(),
				version: 99,
			}),
		);

		const draft = promptStash.consume();
		expect(draft?.autostart).toBe(false);
		expect(draft?.stashedAt).toBe(0);
		expect(draft?.prompt).toBe("Build a watch shop page");
	});

	it("drops versioned payloads without a prompt instead of returning raw JSON", () => {
		window.sessionStorage.setItem(
			"wandit-prompt-stash",
			JSON.stringify({ version: 99 }),
		);

		expect(promptStash.consume()).toBeNull();
	});

	it.each([
		"null",
		"true",
		"42",
		"[]",
		"{}",
		'"quoted"',
	])("drops a JSON literal payload (%s) instead of prefilling it", (stored) => {
		window.sessionStorage.setItem("wandit-prompt-stash", stored);

		expect(promptStash.consume()).toBeNull();
	});

	it("never autostarts a current-version payload with a non-string prompt", () => {
		window.sessionStorage.setItem(
			"wandit-prompt-stash",
			JSON.stringify({
				autostart: true,
				prompt: 5,
				stashedAt: Date.now(),
				version: 3,
			}),
		);

		expect(promptStash.consume()).toBeNull();
	});

	it("never autostarts when the recorded flag or timestamp has the wrong type", () => {
		window.sessionStorage.setItem(
			"wandit-prompt-stash",
			JSON.stringify({
				autostart: "true",
				prompt: "Build a watch shop page",
				stashedAt: String(Date.now()),
				version: 3,
			}),
		);

		expect(promptStash.consume()).toMatchObject({
			autostart: false,
			stashedAt: 0,
		});
	});

	it("downgrades to prefill when the stored composer no longer parses", () => {
		window.sessionStorage.setItem(
			"wandit-prompt-stash",
			JSON.stringify({
				autostart: true,
				composer: { mode: "nope", output: 12 },
				prompt: "Build a watch shop page",
				stashedAt: Date.now(),
				version: 3,
			}),
		);

		expect(promptStash.consume()).toMatchObject({
			autostart: false,
			composer: undefined,
			prompt: "Build a watch shop page",
		});
	});

	it("clears without reading", () => {
		promptStash.stash("Build a watch shop page");

		promptStash.clear();

		expect(promptStash.consume()).toBeNull();
	});

	it("bumps the generation only on clear()", () => {
		const before = promptStash.generation();

		promptStash.stash("Build a watch shop page");
		promptStash.consume();
		expect(promptStash.generation()).toBe(before);

		promptStash.clear();
		expect(promptStash.generation()).toBe(before + 1);
	});

	it("bumps the generation even when storage refuses the clear", () => {
		vi.stubGlobal("window", {
			sessionStorage: {
				getItem: () => null,
				removeItem: () => {
					throw new Error("blocked");
				},
				setItem: () => {
					throw new Error("blocked");
				},
			},
		});
		const before = promptStash.generation();

		promptStash.clear();

		expect(promptStash.generation()).toBe(before + 1);
	});
});
