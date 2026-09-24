// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequestTray } from "./request-tray";
import type { RequestTrayState } from "./types";

// jsdom has no ResizeObserver; the world card row watches its width.
class ResizeObserverStub implements ResizeObserver {
	disconnect() {}
	observe() {}
	takeRecords(): ResizeObserverEntry[] {
		return [];
	}
	unobserve() {}
}

const BASE_STATE: RequestTrayState = {
	badge: "question",
	label: "Needs a detail",
	question: "Which style fits your shop?",
	helper: null,
	step: null,
	body: {
		kind: "single-choice",
		options: [{ id: "warm", label: "Warm" }],
		selectedId: null,
	},
	typingOverride: false,
};

function renderTray(state: Partial<RequestTrayState> = {}) {
	const callbacks = {
		onDelegate: vi.fn(),
		onDismiss: vi.fn(),
		bodyCallbacks: {
			onPick: vi.fn(),
			onToggle: vi.fn(),
			onAddFiles: vi.fn(),
			onRemoveFile: vi.fn(),
		},
	};
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(RequestTray, {
			state: { ...BASE_STATE, ...state },
			...callbacks,
		}),
	};
	render(createElement(I18nProvider, providerProps));
	return callbacks;
}

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("RequestTray", () => {
	it("shows the question and hands a chip tap, Decide for me, and skip to the caller", () => {
		const callbacks = renderTray();
		expect(screen.getByText("Needs a detail")).toBeTruthy();
		expect(screen.getByText("Which style fits your shop?")).toBeTruthy();
		expect(screen.queryByText(/\d of \d/)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Warm" }));
		expect(callbacks.bodyCallbacks.onPick).toHaveBeenCalledWith("warm");
		fireEvent.click(screen.getByRole("button", { name: "Decide for me" }));
		expect(callbacks.onDelegate).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole("button", { name: "Skip the question" }));
		expect(callbacks.onDismiss).toHaveBeenCalledOnce();
	});

	it("shows the step, the helper, and the typing hint", () => {
		renderTray({
			step: { current: 2, total: 3 },
			helper: "Pick the closest one.",
			typingOverride: true,
		});
		expect(screen.getByText("2 of 3")).toBeTruthy();
		expect(screen.getByText("Pick the closest one.")).toBeTruthy();
		expect(screen.getByText("answering in your own words ↓")).toBeTruthy();
	});

	it("shows no body for a free-text question", () => {
		renderTray({ body: { kind: "free-text" } });
		expect(screen.queryByRole("button", { name: "Warm" })).toBeNull();
	});

	it("toggles a multi-select chip", () => {
		const callbacks = renderTray({
			body: {
				kind: "multi-select",
				options: [{ id: "home", label: "Home" }],
				selectedIds: ["home"],
			},
		});
		const chip = screen.getByRole("button", { name: "Home" });
		expect(chip.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(chip);
		expect(callbacks.bodyCallbacks.onToggle).toHaveBeenCalledWith("home");
	});

	it("shows a design world as a specimen card", () => {
		const callbacks = renderTray({
			body: {
				kind: "world-pick",
				options: [
					{
						id: "zellige",
						label: "Warm and crafted",
						card: {
							id: "zellige",
							name: "Zellige",
							tagline: "A courtyard.",
							preview: {
								ground: "#f4efe6",
								ink: "#1d1a16",
								accent: "#1f6f5c",
								fontFamily: "Fraunces",
								sampleWord: "Dar",
							},
						},
					},
				],
				selectedId: null,
			},
		});
		expect(screen.getByText("Zellige")).toBeTruthy();
		expect(screen.getByText("Dar")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /Zellige/ }));
		expect(callbacks.bodyCallbacks.onPick).toHaveBeenCalledWith("zellige");
	});

	it("shows the drop zone first, then the thumbnails with a remove button", () => {
		renderTray({
			badge: "media",
			body: {
				kind: "media-drop",
				accept: "image/png",
				items: [],
				canAddMore: true,
			},
		});
		expect(screen.getByText("Drop your images here")).toBeTruthy();
		cleanup();
		const callbacks = renderTray({
			badge: "media",
			body: {
				kind: "media-drop",
				accept: "image/png",
				items: [
					{
						id: "f1",
						name: "logo.png",
						preview: "none",
						isUploading: false,
						hasError: false,
					},
				],
				canAddMore: false,
			},
		});
		expect(
			screen.queryByRole("button", { name: "Add more images" }),
		).toBeNull();
		expect(screen.queryByRole("img")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Remove logo.png" }));
		expect(callbacks.bodyCallbacks.onRemoveFile).toHaveBeenCalledWith("f1");
	});

	it("says why an image failed", () => {
		renderTray({
			badge: "media",
			body: {
				kind: "media-drop",
				accept: "image/png",
				items: [
					{
						id: "f1",
						name: "brief.pdf",
						preview: "none",
						isUploading: false,
						hasError: true,
					},
				],
				canAddMore: true,
			},
		});
		expect(
			screen.getByRole("img", {
				name: "Upload failed. Use a PNG, JPG, WebP, GIF, or AVIF image under 15 MB.",
			}),
		).toBeTruthy();
	});
});
