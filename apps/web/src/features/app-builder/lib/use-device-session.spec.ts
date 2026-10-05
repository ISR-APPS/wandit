// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type {
	DevicePlatform,
	StartDeviceSessionResponse,
} from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
	AppetizeClient,
	AppetizeSdk,
	AppetizeSession,
} from "./appetize-sdk";
import { type DeviceSessionDeps, useDeviceSession } from "./use-device-session";

const PROJECT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ROW_ID = "11111111-1111-4111-8111-111111111111";

const START_ANSWER: StartDeviceSessionResponse = {
	deviceSessionId: ROW_ID,
	publicKey: "app_public_key",
	device: "iphone15pro",
	osVersion: "17.2",
	launchUrl: "exps://m-abc--p-demo.wanditpreview.app",
	params: {
		EXDevMenuDisableAutoLaunch: true,
		EXKernelDisableNuxDefaultsKey: true,
	},
	timeLimitSeconds: 900,
};

/** A fake SDK whose client sends the session event on start, like Appetize once a device is free. */
function fakeAppetize() {
	const session: AppetizeSession = {
		token: "appetize-token",
		on: () => {},
		heartbeat: async () => {},
		restartApp: async () => {},
		shake: async () => {},
	};
	let onSession: ((session: AppetizeSession) => void) | null = null;
	const client: AppetizeClient = {
		on(event: string, listener: (session: AppetizeSession) => void) {
			if (event === "session") onSession = listener;
		},
		startSession: async () => {
			onSession?.(session);
			return session;
		},
		endSession: vi.fn(async () => {}),
	};
	const sdk: AppetizeSdk = { getClient: async () => client };
	return { client, sdk };
}

function renderSession(platform: DevicePlatform, deps: DeviceSessionDeps) {
	const initialProps: { platform: DevicePlatform | null } = { platform };
	return renderHook(
		(props) => useDeviceSession(PROJECT_ID, props.platform, deps),
		{
			initialProps,
			wrapper: ({ children }: { children: ReactNode }) =>
				createElement(I18nProvider, {
					locale: "en",
					dictionary: fallbackDictionary,
					setLocale: () => {},
					children,
				}),
		},
	);
}

// A macrotask lets the whole promise chain of a start run.
async function settle() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

beforeEach(() => {
	// jsdom has no CSS.escape; the start builds the iframe selector with it.
	vi.stubGlobal("CSS", { escape: (value: string) => value });
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("useDeviceSession", () => {
	it("ends the open session on a target switch and shows the new target idle", async () => {
		const { client, sdk } = fakeAppetize();
		const endDeviceSession = vi
			.fn<DeviceSessionDeps["endDeviceSession"]>()
			.mockResolvedValue(undefined);
		const { result, rerender } = renderSession("ios", {
			startDeviceSession: async () => START_ANSWER,
			endDeviceSession,
			loadAppetize: async () => sdk,
		});

		act(() => result.current.start());
		await settle();
		expect(result.current.phase.kind).toBe("running");

		rerender({ platform: "android" });

		expect(result.current.phase).toEqual({ kind: "idle" });
		expect(client.endSession).toHaveBeenCalledOnce();
		expect(endDeviceSession).toHaveBeenCalledOnce();
		expect(endDeviceSession).toHaveBeenCalledWith(
			PROJECT_ID,
			ROW_ID,
			"appetize-token",
		);
	});

	it("ends a row that the start route answers after a target switch", async () => {
		let answerStart: (answer: StartDeviceSessionResponse) => void = () => {};
		const endDeviceSession = vi
			.fn<DeviceSessionDeps["endDeviceSession"]>()
			.mockResolvedValue(undefined);
		const loadAppetize = vi.fn<DeviceSessionDeps["loadAppetize"]>();
		const { result, rerender } = renderSession("ios", {
			startDeviceSession: () =>
				new Promise((resolve) => {
					answerStart = resolve;
				}),
			endDeviceSession,
			loadAppetize,
		});

		act(() => result.current.start());
		expect(result.current.phase.kind).toBe("starting");
		rerender({ platform: null });
		answerStart(START_ANSWER);
		await settle();

		// No device starts, and the new row ends before it bills a minute.
		expect(loadAppetize).not.toHaveBeenCalled();
		expect(endDeviceSession).toHaveBeenCalledWith(
			PROJECT_ID,
			ROW_ID,
			undefined,
		);
		expect(result.current.phase).toEqual({ kind: "idle" });
	});

	it("leaves the new target alone when the stop of the old one ends late", async () => {
		const NEW_ROW_ID = "22222222-2222-4222-8222-222222222222";
		const { client, sdk } = fakeAppetize();
		let finishOldEnd: () => void = () => {};
		client.endSession = () =>
			new Promise<void>((resolve) => {
				finishOldEnd = resolve;
			});
		const endDeviceSession = vi
			.fn<DeviceSessionDeps["endDeviceSession"]>()
			.mockResolvedValue(undefined);
		const { result, rerender } = renderSession("ios", {
			startDeviceSession: async (_projectId, platform) =>
				platform === "ios"
					? START_ANSWER
					: { ...START_ANSWER, deviceSessionId: NEW_ROW_ID },
			endDeviceSession,
			loadAppetize: async () => sdk,
		});
		act(() => result.current.start());
		await settle();

		// Stop, then switch and start Android while Appetize still ends the iOS session.
		act(() => result.current.stop());
		rerender({ platform: "android" });
		act(() => result.current.start());
		await settle();
		await act(async () => finishOldEnd());
		await settle();

		expect(result.current.phase.kind).toBe("running");
		expect(endDeviceSession).toHaveBeenCalledOnce();
		expect(endDeviceSession).toHaveBeenCalledWith(
			PROJECT_ID,
			ROW_ID,
			"appetize-token",
		);
	});
});
