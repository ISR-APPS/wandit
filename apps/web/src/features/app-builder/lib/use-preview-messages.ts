/**
 * Listens for the messages the preview frame posts to the parent frame.
 * The proxy error pages post `token-expired` or `not-running`. The web
 * template bridge posts the page the app shows. PreviewPanel wires them to
 * usePreviewToken and to the address bar of WebPreview. The hook accepts a
 * message only from the origin of the current preview URL, and only when it
 * matches a schema from `@wandit/contracts`.
 */

import {
	type PreviewParentMessage,
	type PreviewRouteMessage,
	previewParentMessageSchema,
	previewRouteMessageSchema,
} from "@wandit/contracts";
import { useEffect, useEffectEvent } from "react";

// One parse for the two message kinds; the `type` field tells them apart.
const previewFrameMessageSchema = previewParentMessageSchema.or(
	previewRouteMessageSchema,
);

/** Inputs of `usePreviewMessages`. */
export type UsePreviewMessagesInput = {
	/** The signed iframe URL, or null before the first mint. Its origin is the only accepted message source. */
	previewUrl: string | null;
	/** Runs on `token-expired`. Mints a new token; the new iframe src reloads the frame. */
	onTokenExpired: () => void;
	/** Runs on `not-running`. Shows the waking state and starts the mint poll. */
	onNotRunning: () => void;
	/** Runs on `wandit:route` with the pathname and query of the page the app shows. Projects made before the bridge never post it. */
	onRoute?: (path: string) => void;
};

/**
 * Registers one `message` listener on `window` while `previewUrl`
 * exists. It drops every message from another origin, and every message
 * that fails the schemas.
 */
export function usePreviewMessages({
	previewUrl,
	onTokenExpired,
	onNotRunning,
	onRoute,
}: UsePreviewMessagesInput): void {
	// An effect event reads the latest handlers; a fresh callback from a
	// parent render does not re-register the listener.
	const dispatch = useEffectEvent(
		(message: PreviewParentMessage | PreviewRouteMessage) => {
			if (message.type === "wandit:route") onRoute?.(message.path);
			else if (message.event === "token-expired") onTokenExpired();
			else onNotRunning();
		},
	);

	useEffect(() => {
		// No URL means no frame exists that can post a message.
		if (previewUrl === null) {
			return;
		}
		const previewOrigin = new URL(previewUrl).origin;
		const listener = (event: MessageEvent) => {
			// Any window can post a message to this one; the origin check is the security rule.
			if (event.origin !== previewOrigin) {
				return;
			}
			const parsed = previewFrameMessageSchema.safeParse(event.data);
			if (!parsed.success) {
				return;
			}
			dispatch(parsed.data);
		};
		window.addEventListener("message", listener);
		return () => window.removeEventListener("message", listener);
	}, [previewUrl]);
}
