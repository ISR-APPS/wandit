/**
 * Listens for the message the preview proxy error pages post to the
 * parent frame: `token-expired` or `not-running`. PreviewPanel wires it
 * to the bridge commands of usePreviewToken. The hook accepts a message
 * only from the origin of the current preview URL. The message must
 * match `previewParentMessageSchema` from `@wandit/contracts`.
 */

import { previewParentMessageSchema } from "@wandit/contracts";
import { useEffect, useEffectEvent } from "react";

/** Inputs of `usePreviewMessages`. */
export type UsePreviewMessagesInput = {
	/** The signed iframe URL, or null before the first mint. Its origin is the only accepted message source. */
	previewUrl: string | null;
	/** Runs on `token-expired`. Mints a new token; the new iframe src reloads the frame. */
	onTokenExpired: () => void;
	/** Runs on `not-running`. Shows the waking state and starts the mint poll. */
	onNotRunning: () => void;
};

/**
 * Registers one `message` listener on `window` while `previewUrl`
 * exists. It drops every message from another origin, and every message
 * that fails the schema.
 */
export function usePreviewMessages({
	previewUrl,
	onTokenExpired,
	onNotRunning,
}: UsePreviewMessagesInput): void {
	// An effect event reads the latest handlers; a fresh callback from a
	// parent render does not re-register the listener.
	const dispatch = useEffectEvent((event: "token-expired" | "not-running") => {
		if (event === "token-expired") onTokenExpired();
		else onNotRunning();
	});

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
			const parsed = previewParentMessageSchema.safeParse(event.data);
			if (!parsed.success) {
				return;
			}
			dispatch(parsed.data.event);
		};
		window.addEventListener("message", listener);
		return () => window.removeEventListener("message", listener);
	}, [previewUrl]);
}
