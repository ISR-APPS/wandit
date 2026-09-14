/**
 * Pure helpers of the app builder, with no React. One picks the More panels
 * of a project kind. Two pairs store the open state and the split layout of
 * the chat card. One copies text to the clipboard.
 * Called by the page, the More view, the route file, and the chat cards.
 */

import type { AppProjectKind } from "../api/dto";
import {
	CHAT_LAYOUT_STORAGE_KEY,
	CHAT_OPEN_STORAGE_KEY,
	MORE_PANEL_META,
	MORE_PANELS,
	type MorePanel,
} from "./constants";
import { chatLayoutSchema } from "./schemas";

/** More panels the nav lists for a project kind, in nav order. */
export function panelsForKind(kind: AppProjectKind): MorePanel[] {
	return MORE_PANELS.filter((panel) =>
		MORE_PANEL_META[panel].kinds.includes(kind),
	);
}

/**
 * The panel to show for a URL request. A panel the kind does not have, or no
 * panel at all, opens the first panel of the nav.
 */
export function resolveMorePanel(
	kind: AppProjectKind,
	requested: MorePanel | undefined,
): MorePanel {
	if (requested && panelsForKind(kind).includes(requested)) return requested;
	// Analytics is listed for every kind, so it is always a valid fallback.
	return "analytics";
}

/** Open state of the chat pane from the last visit. Open when nothing is stored or storage fails. */
export function readChatOpen(): boolean {
	try {
		return window.localStorage.getItem(CHAT_OPEN_STORAGE_KEY) !== "closed";
	} catch {
		return true;
	}
}

/** Stores the chat pane open state. A storage failure is not an error for the user. */
export function writeChatOpen(open: boolean): void {
	try {
		window.localStorage.setItem(
			CHAT_OPEN_STORAGE_KEY,
			open ? "open" : "closed",
		);
	} catch {
		// Private mode or a full quota: the pane state only lasts the session.
	}
}

/** Split layout of the last visit, or undefined when nothing valid is stored. Passed to the panel group as defaultLayout. */
export function readChatLayout(): Record<string, number> | undefined {
	try {
		const raw = window.localStorage.getItem(CHAT_LAYOUT_STORAGE_KEY);
		if (!raw) return undefined;
		// JSON.parse stays inside the try: a user or an extension can corrupt the value.
		const { success, data } = chatLayoutSchema.safeParse(JSON.parse(raw));
		return success ? data : undefined;
	} catch {
		return undefined;
	}
}

/** Stores the split layout after a drag. A storage failure is not an error for the user. */
export function writeChatLayout(layout: Record<string, number>): void {
	try {
		window.localStorage.setItem(
			CHAT_LAYOUT_STORAGE_KEY,
			JSON.stringify(layout),
		);
	} catch {
		// Private mode or a full quota: the layout only lasts the session.
	}
}

/** Writes text to the clipboard. False, with a console error, when the browser refuses. */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		// The browser refuses the clipboard outside a user gesture or a secure origin.
		console.error("Copy to the clipboard failed", error);
		return false;
	}
}
