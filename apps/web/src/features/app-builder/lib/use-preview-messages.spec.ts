// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type {
	PreviewParentMessage,
	PreviewRouteMessage,
} from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePreviewMessages } from "./use-preview-messages";

const PREVIEW_URL =
	"https://r-abcdef123456--p-a1b2c3d4-e5f6-7890-abcd-ef1234567890.wanditpreview.app/?wt=t1";
const PREVIEW_ORIGIN =
	"https://r-abcdef123456--p-a1b2c3d4-e5f6-7890-abcd-ef1234567890.wanditpreview.app";

// Sends one message to the window listener, inside act.
function postMessage(
	origin: string,
	data:
		| PreviewParentMessage
		| PreviewRouteMessage
		| { type: string; path?: string },
) {
	act(() => {
		window.dispatchEvent(new MessageEvent("message", { origin, data }));
	});
}

afterEach(cleanup);

describe("usePreviewMessages", () => {
	it("ignores a message from another origin", () => {
		const onTokenExpired = vi.fn();
		const onNotRunning = vi.fn();
		renderHook(() =>
			usePreviewMessages({
				previewUrl: PREVIEW_URL,
				onTokenExpired,
				onNotRunning,
			}),
		);

		postMessage("https://evil.example.com", {
			type: "wandit:preview",
			event: "token-expired",
		});

		expect(onTokenExpired).not.toHaveBeenCalled();
		expect(onNotRunning).not.toHaveBeenCalled();
	});

	it("calls onTokenExpired on a token-expired message from the preview origin", () => {
		const onTokenExpired = vi.fn();
		const onNotRunning = vi.fn();
		renderHook(() =>
			usePreviewMessages({
				previewUrl: PREVIEW_URL,
				onTokenExpired,
				onNotRunning,
			}),
		);

		postMessage(PREVIEW_ORIGIN, {
			type: "wandit:preview",
			event: "token-expired",
		});

		expect(onTokenExpired).toHaveBeenCalledTimes(1);
		expect(onNotRunning).not.toHaveBeenCalled();
	});

	it("calls onNotRunning on a not-running message from the preview origin", () => {
		const onTokenExpired = vi.fn();
		const onNotRunning = vi.fn();
		renderHook(() =>
			usePreviewMessages({
				previewUrl: PREVIEW_URL,
				onTokenExpired,
				onNotRunning,
			}),
		);

		postMessage(PREVIEW_ORIGIN, {
			type: "wandit:preview",
			event: "not-running",
		});

		expect(onNotRunning).toHaveBeenCalledTimes(1);
		expect(onTokenExpired).not.toHaveBeenCalled();
	});

	it("ignores a payload that fails the schema", () => {
		const onTokenExpired = vi.fn();
		const onNotRunning = vi.fn();
		renderHook(() =>
			usePreviewMessages({
				previewUrl: PREVIEW_URL,
				onTokenExpired,
				onNotRunning,
			}),
		);

		postMessage(PREVIEW_ORIGIN, { type: "other" });

		expect(onTokenExpired).not.toHaveBeenCalled();
		expect(onNotRunning).not.toHaveBeenCalled();
	});

	it("ignores every message while previewUrl is null", () => {
		const onTokenExpired = vi.fn();
		const onNotRunning = vi.fn();
		renderHook(() =>
			usePreviewMessages({ previewUrl: null, onTokenExpired, onNotRunning }),
		);

		postMessage(PREVIEW_ORIGIN, {
			type: "wandit:preview",
			event: "token-expired",
		});

		expect(onTokenExpired).not.toHaveBeenCalled();
		expect(onNotRunning).not.toHaveBeenCalled();
	});

	it("calls onRoute with the path of a route message from the preview origin", () => {
		const onRoute = vi.fn();
		renderHook(() =>
			usePreviewMessages({
				previewUrl: PREVIEW_URL,
				onTokenExpired: vi.fn(),
				onNotRunning: vi.fn(),
				onRoute,
			}),
		);

		postMessage(PREVIEW_ORIGIN, {
			type: "wandit:route",
			path: "/invoices?page=2",
		});

		expect(onRoute).toHaveBeenCalledWith("/invoices?page=2");
	});

	// The frame runs user code, so a route message must pass the origin check and the schema.
	it.each([
		["another origin", "https://evil.example.com", "/invoices"],
		["a path without a leading slash", PREVIEW_ORIGIN, "invoices"],
	])("ignores a route message from %s", (_case, origin, path) => {
		const onRoute = vi.fn();
		renderHook(() =>
			usePreviewMessages({
				previewUrl: PREVIEW_URL,
				onTokenExpired: vi.fn(),
				onNotRunning: vi.fn(),
				onRoute,
			}),
		);

		postMessage(origin, { type: "wandit:route", path });

		expect(onRoute).not.toHaveBeenCalled();
	});
});
