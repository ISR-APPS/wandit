// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	DeviceBarControls,
	type DeviceBarControlsProps,
	DeviceScreen,
	type DeviceScreenProps,
	formatCountdown,
} from "./device-panel";

const FRAME_TITLE = "iOS device with Nadi Fitness";

// The page mounts one TooltipProvider; the bar buttons need it too.
function renderInApp(element: ReactElement) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(TooltipProvider, null, element),
	};
	render(createElement(I18nProvider, providerProps));
}

function renderScreen(overrides: Partial<DeviceScreenProps>) {
	const props: DeviceScreenProps = {
		platform: "ios",
		phase: { kind: "idle" },
		idleWarningSeconds: null,
		frameId: "device-frame-1",
		title: FRAME_TITLE,
		onStart: vi.fn(),
		...overrides,
	};
	renderInApp(createElement(DeviceScreen, props));
	return props;
}

function renderBar(overrides: Partial<DeviceBarControlsProps>) {
	const props: DeviceBarControlsProps = {
		phase: { kind: "idle" },
		isCompact: false,
		onStop: vi.fn(),
		onRestartApp: vi.fn(),
		onDevMenu: vi.fn(),
		...overrides,
	};
	renderInApp(createElement(DeviceBarControls, props));
	return props;
}

afterEach(cleanup);

describe("DeviceScreen", () => {
	it("mounts no stream before the turn-on button, and starts on it", () => {
		const props = renderScreen({});

		expect(screen.queryByTitle(FRAME_TITLE)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
		expect(props.onStart).toHaveBeenCalledOnce();
	});

	it("keeps the start button off after the month minutes are spent", () => {
		renderScreen({
			phase: {
				kind: "error",
				message: "You used all your device minutes this month.",
				isExhausted: true,
				didStart: false,
			},
		});

		expect(screen.getByRole("alert").textContent).toContain(
			"You used all your device minutes this month.",
		);
		expect(
			screen
				.getByRole("button", { name: "Try again" })
				.hasAttribute("disabled"),
		).toBe(true);
	});

	it("shows the idle warning over the running stream", () => {
		renderScreen({
			phase: { kind: "running", endsAtMs: 0 },
			idleWarningSeconds: 29.5,
		});

		expect(screen.getByTitle(FRAME_TITLE)).toBeTruthy();
		expect(
			screen.getByText("The device stops in 30 s without activity."),
		).toBeTruthy();
	});
});

describe("DeviceBarControls", () => {
	it("shows a stop button in the queue, and nothing while starting", () => {
		const queued = renderBar({ phase: { kind: "queued", position: 4 } });
		fireEvent.click(screen.getByRole("button", { name: "Stop" }));
		expect(queued.onStop).toHaveBeenCalledOnce();
		cleanup();

		// No session exists while the start call runs, so there is nothing to stop.
		renderBar({ phase: { kind: "starting" } });
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("shows the countdown while running", () => {
		renderBar({
			phase: { kind: "running", endsAtMs: Date.now() + 125_000 },
		});

		expect(screen.getByText("2:05 left")).toBeTruthy();
	});
});

describe("formatCountdown", () => {
	it.each([
		[0, "0:00"],
		[9, "0:09"],
		[60, "1:00"],
		[900, "15:00"],
	])("formats %i s as %s", (seconds, text) => {
		expect(formatCountdown(seconds)).toBe(text);
	});
});
