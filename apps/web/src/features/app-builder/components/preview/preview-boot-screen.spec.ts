// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BootContext } from "../../lib/boot-state";
import { PreviewBootScreen } from "./preview-boot-screen";

const FIRST_TURN_BOOTING: BootContext = {
	isTurnRunning: true,
	turnPhase: "sandbox_waking",
	lastTurnFailed: false,
	isFirstTurn: true,
	backend: undefined,
	hasCodeChanges: true,
	isPlanning: false,
};

const NO_TURN: BootContext = {
	...FIRST_TURN_BOOTING,
	isTurnRunning: false,
	turnPhase: null,
};

const WAKE_BOOTING: BootContext = { ...FIRST_TURN_BOOTING, isFirstTurn: false };

/** The turn phase after the sandbox answers. The screen then opens the app. */
const SESSION_STARTING = "session_starting";

/** The wake button needs a query client. No case clicks it, so one client serves every case. */
const queryClient = new QueryClient();

function screenElement(bootContext: BootContext) {
	return createElement(
		QueryClientProvider,
		{ client: queryClient },
		// I18nProvider requires children in its props type for createElement calls.
		createElement(I18nProvider, {
			locale: "en",
			dictionary: fallbackDictionary,
			setLocale: () => {},
			children: createElement(PreviewBootScreen, {
				projectId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
				tokenStatus: "waking",
				bootContext,
			}),
		} satisfies ComponentProps<typeof I18nProvider>),
	);
}

function renderScreen(bootContext: BootContext = FIRST_TURN_BOOTING) {
	return render(screenElement(bootContext));
}

/** The scene of the picture, from its `data-scene` attribute. */
function sceneShown(container: HTMLElement): string | null {
	return (
		container.querySelector("[data-scene]")?.getAttribute("data-scene") ?? null
	);
}

/** The parts of both app drawings: the draw-on paths outside the server room (viewBox 0 0 320 200), whose cables also draw on. */
function planParts(container: HTMLElement): Element[] {
	return [...container.querySelectorAll("path[stroke-dasharray='1 1']")].filter(
		(part) => part.closest("svg")?.getAttribute("viewBox") !== "0 0 320 200",
	);
}

/** Moves the fake clock and lets React and motion finish the frames of that time. */
async function advance(ms: number) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("PreviewBootScreen", () => {
	it("shows each detail line for 3.2 s and then keeps the last one", async () => {
		renderScreen();
		expect(screen.getByText("Gathering the pieces of your app")).toBeTruthy();

		await advance(3_200);
		await advance(500);
		expect(screen.getByText("Putting it all together")).toBeTruthy();
		expect(screen.queryByText("Gathering the pieces of your app")).toBeNull();

		await advance(3_200);
		expect(
			screen.getByText("The first time takes a little longer"),
		).toBeTruthy();

		// A loop would read as "it started again", so the last line stays.
		await advance(10_000);
		expect(
			screen.getByText("The first time takes a little longer"),
		).toBeTruthy();
	});

	it("never shows the asleep note when the turn connects inside the 1.2 s wait", async () => {
		const { rerender } = renderScreen(NO_TURN);
		expect(screen.getByRole("status").textContent).toBe("Loading your app");

		// On a new project the turn stream connects shortly after the first waking answer.
		await advance(500);
		rerender(screenElement(FIRST_TURN_BOOTING));
		await advance(2_000);

		expect(screen.getByText("Setting up your new app")).toBeTruthy();
		expect(screen.queryByText("Your app is asleep")).toBeNull();
	});

	it("hides the app drawing while a new app is set up, then draws it when the app answers", async () => {
		const { container, rerender } = renderScreen();
		expect(sceneShown(container)).toBe("create");
		expect(planParts(container)).toHaveLength(0);

		rerender(
			screenElement({ ...FIRST_TURN_BOOTING, turnPhase: SESSION_STARTING }),
		);
		expect(sceneShown(container)).toBe("open");
		expect(planParts(container).length).toBeGreaterThan(0);
		for (const part of planParts(container)) {
			expect(part.getAttribute("class")).toContain("animate-draw");
		}
		await advance(1_000);
		expect(screen.getByText("All set")).toBeTruthy();
	});

	// The server room takes the place of the drawing for a new app and for a saved app.
	it.each([
		{ app: "a new app", booting: FIRST_TURN_BOOTING, scene: "create" },
		{ app: "a saved app", booting: WAKE_BOOTING, scene: "wake" },
	])("keeps the sleeping drawing while it fades out for $app, then draws it again", async ({
		booting,
		scene,
	}) => {
		const { container, rerender } = renderScreen(NO_TURN);
		await advance(1_300);
		expect(sceneShown(container)).toBe("asleep");
		// The first anchor is the wide one. The Spark rests on the center of the app picture.
		const anchorStyle = container
			.querySelector("div[style*='inset-inline-start']")
			?.getAttribute("style");
		expect(anchorStyle).toContain("inset-inline-start: 71.8%");
		expect(anchorStyle).toContain("top: 45.09%");

		rerender(screenElement(booting));
		expect(sceneShown(container)).toBe(scene);
		expect(planParts(container).length).toBeGreaterThan(0);

		rerender(screenElement({ ...booting, turnPhase: SESSION_STARTING }));
		expect(sceneShown(container)).toBe("open");
		for (const part of planParts(container)) {
			expect(part.getAttribute("class")).toContain("animate-draw");
		}
	});

	it("starts the amber buttons hidden when the app answers at mount", () => {
		const { container } = renderScreen({
			...FIRST_TURN_BOOTING,
			turnPhase: SESSION_STARTING,
		});
		// The button fills sit in a group after the drawing parts.
		const fills = container.querySelectorAll(
			"path[stroke-dasharray='1 1'] ~ g > path.fill-spark",
		);
		expect(fills.length).toBeGreaterThan(0);
		for (const fill of fills) {
			expect(fill.parentElement?.getAttribute("opacity")).toBe("0");
		}
	});

	it("turns the Spark by half turns only while a new app is set up", async () => {
		const { container, rerender } = renderScreen();
		const rotation = () =>
			container.querySelector("span[style*='rotate']")?.getAttribute("style");
		expect(rotation()).toContain("rotate: 180deg");

		await advance(6_400);
		expect(rotation()).toContain("rotate: 360deg");

		rerender(
			screenElement({ ...FIRST_TURN_BOOTING, turnPhase: SESSION_STARTING }),
		);
		await advance(13_000);
		expect(rotation()).toContain("rotate: 360deg");
	});

	it("holds the waiting note 1.2 s after a template-only turn ends", async () => {
		const templateOnly = { ...FIRST_TURN_BOOTING, hasCodeChanges: false };
		const { rerender } = renderScreen(templateOnly);
		expect(screen.getByText("Building your first version")).toBeTruthy();

		// The turn ended, and the project refetch did not land yet.
		rerender(screenElement({ ...templateOnly, isTurnRunning: false }));
		await advance(500);
		expect(screen.getByRole("status").textContent).toBe("Loading your app");

		await advance(1_000);
		expect(screen.getByRole("status").textContent).toBe(
			"Waiting for your next step… Continue in the chat when you are ready.",
		);
	});

	it("counts the elapsed time as m:ss", async () => {
		renderScreen();
		expect(screen.getByText("0:00")).toBeTruthy();

		await advance(75_000);
		expect(screen.getByText("1:15")).toBeTruthy();
	});
});
