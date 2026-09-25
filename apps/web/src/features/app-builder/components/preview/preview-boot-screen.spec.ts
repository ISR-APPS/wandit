// @vitest-environment jsdom

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
};

const NO_TURN: BootContext = {
	...FIRST_TURN_BOOTING,
	isTurnRunning: false,
	turnPhase: null,
};

function screenElement(bootContext: BootContext) {
	// I18nProvider requires children in its props type for createElement calls.
	return createElement(I18nProvider, {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(PreviewBootScreen, {
			tokenStatus: "waking",
			bootContext,
		}),
	} satisfies ComponentProps<typeof I18nProvider>);
}

function renderScreen(bootContext: BootContext = FIRST_TURN_BOOTING) {
	return render(screenElement(bootContext));
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
	it("shows the second detail line after 3.2 s and then keeps it", async () => {
		renderScreen();
		expect(screen.getByText("Copying the starter files")).toBeTruthy();

		await advance(3_200);
		await advance(500);
		expect(screen.getByText("Installing packages")).toBeTruthy();
		expect(screen.queryByText("Copying the starter files")).toBeNull();

		// A loop would read as "it started again", so the last line stays.
		await advance(10_000);
		expect(screen.getByText("Installing packages")).toBeTruthy();
	});

	it("never shows the asleep note when the turn connects inside the 1.2 s wait", async () => {
		const { rerender } = renderScreen(NO_TURN);
		expect(screen.getByRole("status").textContent).toBe("Loading the preview");

		// On a new project the turn stream connects shortly after the first waking answer.
		await advance(500);
		rerender(screenElement(FIRST_TURN_BOOTING));
		await advance(2_000);

		expect(screen.getByText("Starting a cloud machine")).toBeTruthy();
		expect(screen.queryByText("Your app is asleep")).toBeNull();
	});

	it("holds the waiting note 1.2 s after a template-only turn ends", async () => {
		const templateOnly = { ...FIRST_TURN_BOOTING, hasCodeChanges: false };
		const { rerender } = renderScreen(templateOnly);
		expect(screen.getByText("Building your first version")).toBeTruthy();

		// The turn ended, and the project refetch did not land yet.
		rerender(screenElement({ ...templateOnly, isTurnRunning: false }));
		await advance(500);
		expect(screen.getByRole("status").textContent).toBe("Loading the preview");

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
