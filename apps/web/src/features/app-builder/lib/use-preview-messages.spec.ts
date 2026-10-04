// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePreviewMessages } from "./use-preview-messages";

const PREVIEW_URL =
	"https://r-abcdef123456--p-a1b2c3d4-e5f6-7890-abcd-ef1234567890.wanditpreview.app/?wt=t1";
const PREVIEW_ORIGIN =
	"https://r-abcdef123456--p-a1b2c3d4-e5f6-7890-abcd-ef1234567890.wanditpreview.app";

const TOKEN_EXPIRED = { type: "wandit:preview", event: "token-expired" };
const RUNTIME_ERROR = {
	type: "wandit:runtime-error",
	message: "x is not a function",
	stack: "at Hero (/src/components/hero.tsx:12:5)",
};
const SELECT_SOURCE = {
	type: "wandit:select-source",
	src: "src/routes/index.tsx:42:7",
	tag: "button",
	label: "Order now",
};

// The preview iframe. Its window is the source the hook accepts.
let frame: HTMLIFrameElement;
// Another window on the same origin, like a frame inside the app.
let otherFrame: HTMLIFrameElement;

beforeEach(() => {
	frame = document.createElement("iframe");
	otherFrame = document.createElement("iframe");
	document.body.append(frame, otherFrame);
});

afterEach(() => {
	cleanup();
	frame.remove();
	otherFrame.remove();
});

function renderListener(previewUrl: string | null) {
	const handlers = {
		onTokenExpired: vi.fn(),
		onNotRunning: vi.fn(),
		onBridgeMessage: vi.fn(),
	};
	renderHook(() =>
		usePreviewMessages({
			previewUrl,
			frameRef: { current: frame },
			...handlers,
		}),
	);
	return handlers;
}

// Sends one message to the window listener, inside act.
function post(input: {
	origin: string;
	source: Window | null;
	data: Record<string, string>;
}) {
	act(() => {
		window.dispatchEvent(
			new MessageEvent("message", {
				origin: input.origin,
				source: input.source,
				data: input.data,
			}),
		);
	});
}

describe("usePreviewMessages", () => {
	it("calls onTokenExpired on a token-expired message from the preview frame", () => {
		const handlers = renderListener(PREVIEW_URL);

		post({
			origin: PREVIEW_ORIGIN,
			source: frame.contentWindow,
			data: TOKEN_EXPIRED,
		});

		expect(handlers.onTokenExpired).toHaveBeenCalledTimes(1);
		expect(handlers.onNotRunning).not.toHaveBeenCalled();
		expect(handlers.onBridgeMessage).not.toHaveBeenCalled();
	});

	it("calls onNotRunning on a not-running message from the preview frame", () => {
		const handlers = renderListener(PREVIEW_URL);

		post({
			origin: PREVIEW_ORIGIN,
			source: frame.contentWindow,
			data: { type: "wandit:preview", event: "not-running" },
		});

		expect(handlers.onNotRunning).toHaveBeenCalledTimes(1);
		expect(handlers.onTokenExpired).not.toHaveBeenCalled();
	});

	it.each([
		{ name: "a runtime error", data: RUNTIME_ERROR },
		{ name: "a picked element", data: SELECT_SOURCE },
		{
			name: "a pick in a TanStack route file with an optional segment",
			data: {
				...SELECT_SOURCE,
				src: "src/routes/{-$locale}/(shop)/$id.tsx:3:5",
			},
		},
	])("passes $name from the preview frame to onBridgeMessage", ({ data }) => {
		const handlers = renderListener(PREVIEW_URL);

		post({ origin: PREVIEW_ORIGIN, source: frame.contentWindow, data });

		expect(handlers.onBridgeMessage).toHaveBeenCalledWith(data);
	});

	it.each([
		{
			name: "another origin",
			origin: "https://evil.example.com",
			source: () => frame.contentWindow,
			data: RUNTIME_ERROR,
		},
		{
			name: "another window of the preview origin",
			origin: PREVIEW_ORIGIN,
			source: () => otherFrame.contentWindow,
			data: SELECT_SOURCE,
		},
		{
			name: "no source window",
			origin: PREVIEW_ORIGIN,
			source: () => null,
			data: TOKEN_EXPIRED,
		},
		{
			name: "a payload that fails the schema",
			origin: PREVIEW_ORIGIN,
			source: () => frame.contentWindow,
			data: { type: "other" },
		},
		{
			name: "a label with half of an emoji pair",
			origin: PREVIEW_ORIGIN,
			source: () => frame.contentWindow,
			data: { ...SELECT_SOURCE, label: "Party \uD83C" },
		},
		{
			name: "a source location that is not file:line:col",
			origin: PREVIEW_ORIGIN,
			source: () => frame.contentWindow,
			data: { ...SELECT_SOURCE, src: "javascript:alert(1)" },
		},
	])("ignores a message from $name", ({ origin, source, data }) => {
		const handlers = renderListener(PREVIEW_URL);

		post({ origin, source: source(), data });

		expect(handlers.onTokenExpired).not.toHaveBeenCalled();
		expect(handlers.onNotRunning).not.toHaveBeenCalled();
		expect(handlers.onBridgeMessage).not.toHaveBeenCalled();
	});

	it("ignores every message while previewUrl is null", () => {
		const handlers = renderListener(null);

		post({
			origin: PREVIEW_ORIGIN,
			source: frame.contentWindow,
			data: TOKEN_EXPIRED,
		});

		expect(handlers.onTokenExpired).not.toHaveBeenCalled();
	});
});
