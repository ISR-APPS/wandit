// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	DeviceControls,
	type DeviceControlsProps,
	formatCountdown,
} from "./device-panel";

function renderControls(overrides: Partial<DeviceControlsProps>) {
	const props: DeviceControlsProps = {
		phase: { kind: "idle" },
		remainingSeconds: null,
		idleWarningSeconds: null,
		onStart: vi.fn(),
		onStop: vi.fn(),
		onReload: vi.fn(),
		onDevMenu: vi.fn(),
		...overrides,
	};
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(DeviceControls, props),
	};
	render(createElement(I18nProvider, providerProps));
	return props;
}

afterEach(cleanup);

describe("DeviceControls", () => {
	it("starts on the button from the idle state", () => {
		const props = renderControls({});

		fireEvent.click(screen.getByRole("button", { name: "Start the device" }));

		expect(props.onStart).toHaveBeenCalledOnce();
	});

	it("keeps the start button off after the month minutes are spent", () => {
		renderControls({
			phase: {
				kind: "error",
				message: "You used all your device minutes this month.",
				isExhausted: true,
			},
		});

		expect(screen.getByRole("alert").textContent).toContain(
			"You used all your device minutes this month.",
		);
		expect(
			screen
				.getByRole("button", { name: "Start again" })
				.hasAttribute("disabled"),
		).toBe(true);
	});

	it("shows the queue place with a stop button, and no stop button while starting", () => {
		const queued = renderControls({ phase: { kind: "queued", position: 4 } });
		expect(
			screen.getByText("All devices are busy. You are number 4 in line."),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Stop" }));
		expect(queued.onStop).toHaveBeenCalledOnce();
		cleanup();

		renderControls({ phase: { kind: "starting" } });
		expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
	});

	it("shows the countdown, the reload, and the dev menu while running, and the idle warning first", () => {
		const props = renderControls({
			phase: { kind: "running", endsAtMs: 0 },
			remainingSeconds: 125,
		});
		expect(screen.getByText("2:05 left")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Reload the app" }));
		fireEvent.click(screen.getByRole("button", { name: "Open the dev menu" }));
		expect(props.onReload).toHaveBeenCalledOnce();
		expect(props.onDevMenu).toHaveBeenCalledOnce();
		cleanup();

		renderControls({
			phase: { kind: "running", endsAtMs: 0 },
			remainingSeconds: 125,
			idleWarningSeconds: 29.5,
		});
		expect(
			screen.getByText("The device stops in 30 s without activity."),
		).toBeTruthy();
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
