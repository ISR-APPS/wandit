import { createBrowserHistory } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	getPreviewPromptFromHistoryState,
	MAX_PREVIEW_PROMPT_LENGTH,
	migrateLegacyPreviewPromptUrl,
	normalizePreviewPrompt,
	PREVIEW_PROMPT_STATE_KEY,
} from "./preview-prompt";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("preview prompt history handoff", () => {
	it("reads and bounds a prompt from history state", () => {
		const prompt = "x".repeat(MAX_PREVIEW_PROMPT_LENGTH + 1);

		expect(
			getPreviewPromptFromHistoryState({
				[PREVIEW_PROMPT_STATE_KEY]: prompt,
			}),
		).toBe(prompt.slice(0, MAX_PREVIEW_PROMPT_LENGTH));
	});

	it("keeps the rollout-era search prompt normalization behavior", () => {
		expect(normalizePreviewPrompt("  keep spacing  ")).toBe("  keep spacing  ");
		expect(normalizePreviewPrompt("   ")).toBeUndefined();
		expect(normalizePreviewPrompt(42)).toBeUndefined();
	});

	it("moves a legacy prompt into history state before app bootstrap", () => {
		let currentUrl = new URL(
			"https://wandit.test/preview?prompt=private&keep=yes#chat",
		);
		let currentState: Record<string, unknown> | null = null;
		const replaceState = vi.fn(
			(
				nextState: Record<string, unknown>,
				_title: string,
				nextUrl?: string,
			) => {
				currentState = nextState;
				if (nextUrl) currentUrl = new URL(nextUrl, currentUrl);
			},
		);
		const fakeWindow = {
			addEventListener: vi.fn(),
			history: {
				back: vi.fn(),
				forward: vi.fn(),
				go: vi.fn(),
				length: 1,
				pushState: vi.fn(),
				replaceState,
				get state() {
					return currentState;
				},
			},
			location: {
				get hash() {
					return currentUrl.hash;
				},
				get href() {
					return currentUrl.href;
				},
				get pathname() {
					return currentUrl.pathname;
				},
				get search() {
					return currentUrl.search;
				},
			},
			removeEventListener: vi.fn(),
		};
		vi.stubGlobal("window", fakeWindow);
		const history = createBrowserHistory({ window: fakeWindow });

		migrateLegacyPreviewPromptUrl();

		expect(currentState).toMatchObject({
			__TSR_index: 0,
			__TSR_key: expect.any(String),
			[PREVIEW_PROMPT_STATE_KEY]: "private",
		});
		expect(history.location.href).toBe("/preview?keep=yes#chat");
		expect(currentUrl.href).toBe("https://wandit.test/preview?keep=yes#chat");
		history.destroy();
	});
});
