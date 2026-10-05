/**
 * Listens for the messages of the preview frame. The preview proxy error
 * pages post `token-expired` or `not-running`. The dev bridge of the web
 * template posts `ready`, runtime errors, the elements the user picks, and
 * the page the app shows. PreviewPanel wires the proxy events to
 * usePreviewToken and passes the bridge messages up. The hook accepts a message only from the window of the
 * preview iframe, on the origin of the current preview URL, and only when it
 * matches a schema of `@wandit/contracts`.
 */

import {
	type PreviewBridgeMessage,
	previewBridgeMessageSchema,
	previewParentMessageSchema,
} from "@wandit/contracts";
import { type RefObject, useEffect, useEffectEvent } from "react";

/** Inputs of `usePreviewMessages`. */
export type UsePreviewMessagesInput = {
	/** The signed iframe URL, or null before the first mint. Its origin is the only accepted message origin. */
	previewUrl: string | null;
	/** The preview iframe. Its window is the only accepted message source. */
	frameRef: RefObject<HTMLIFrameElement | null>;
	/** Runs on `token-expired`. Mints a new token; the new iframe src reloads the frame. */
	onTokenExpired: () => void;
	/** Runs on `not-running`. Shows the waking state and starts the mint poll. */
	onNotRunning: () => void;
	/** Runs on each valid message of the template dev bridge. */
	onBridgeMessage: (message: PreviewBridgeMessage) => void;
};

/**
 * Registers one `message` listener on `window` while `previewUrl`
 * exists. It drops every message from another origin or another window,
 * and every message that fails the schemas.
 */
export function usePreviewMessages({
	previewUrl,
	frameRef,
	onTokenExpired,
	onNotRunning,
	onBridgeMessage,
}: UsePreviewMessagesInput): void {
	// An effect event reads the latest handlers; a fresh callback from a
	// parent render does not re-register the listener.
	const dispatchProxyEvent = useEffectEvent(
		(event: "token-expired" | "not-running") => {
			if (event === "token-expired") onTokenExpired();
			else onNotRunning();
		},
	);
	const dispatchBridgeMessage = useEffectEvent(onBridgeMessage);

	useEffect(() => {
		// No URL means no frame exists that can post a message.
		if (previewUrl === null) {
			return;
		}
		const previewOrigin = new URL(previewUrl).origin;
		const listener = (event: MessageEvent) => {
			// Any window can post a message to this one. The origin check is the security rule.
			if (event.origin !== previewOrigin) {
				return;
			}
			// A frame inside the app has the same origin, but it must not speak for the preview.
			const frameWindow = frameRef.current?.contentWindow;
			if (!frameWindow || event.source !== frameWindow) {
				return;
			}
			const proxyMessage = previewParentMessageSchema.safeParse(event.data);
			if (proxyMessage.success) {
				dispatchProxyEvent(proxyMessage.data.event);
				return;
			}
			const bridgeMessage = previewBridgeMessageSchema.safeParse(event.data);
			if (bridgeMessage.success) {
				dispatchBridgeMessage(bridgeMessage.data);
			}
		};
		window.addEventListener("message", listener);
		return () => window.removeEventListener("message", listener);
	}, [previewUrl, frameRef]);
}
