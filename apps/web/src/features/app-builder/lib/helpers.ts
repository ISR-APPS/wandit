/**
 * Pure helpers of the app builder, with no React. Four list and test the
 * panels of the More view and pick the open one. Three pairs store the open
 * state and the split layout of the chat column, and the Expo Go username.
 * One copies text to the clipboard. One puts an app page path on the signed
 * preview URL. Called by the page, the More view and its nav, the chat
 * cards, the Expo Go popover, and the preview panel.
 */

import { expoUsernameSchema } from "@wandit/contracts";

import type { AppProjectKind } from "../api/dto";
import {
	CHAT_LAYOUT_STORAGE_KEY,
	CHAT_OPEN_STORAGE_KEY,
	CLOUD_PANELS,
	type CloudPanel,
	EXPO_GO_USERNAME_STORAGE_KEY,
	MORE_PANEL_META,
	MORE_PANELS,
	type MorePanel,
	type ProjectPanel,
} from "./constants";
import { chatLayoutSchema } from "./schemas";

/** More panels the nav lists for a project kind, in nav order. Disabled panels are in the list. */
export function panelsForKind(kind: AppProjectKind): MorePanel[] {
	return MORE_PANELS.filter((panel) =>
		MORE_PANEL_META[panel].kinds.includes(kind),
	);
}

/**
 * True for an id of the Backend group. More view renders it through
 * CloudPanelContent. PanelShell reads its title from `workspace.cloud` and
 * gives it a wider body.
 */
export function isCloudPanel(
	panel: MorePanel | CloudPanel,
): panel is CloudPanel {
	return CLOUD_PANELS.some((cloudPanel) => cloudPanel === panel);
}

/** True for Integrations: the nav shows it as "Soon", and it never opens. */
export function isDisabledMorePanel(panel: MorePanel): panel is "integrations" {
	return panel === "integrations";
}

/**
 * The panel the More view opens for the `?panel=` request. A Cloud panel
 * opens only while the Cloud gate is open. A panel the kind does not have,
 * a disabled panel, or no request opens the fallback panel.
 */
export function resolvePanel(
	kind: AppProjectKind,
	requested: MorePanel | CloudPanel | undefined,
	isCloudTabEnabled: boolean,
): ProjectPanel {
	if (requested !== undefined) {
		if (isCloudPanel(requested)) {
			// The Cloud panels are behind a rollout gate. A shared link must not open an empty panel.
			if (isCloudTabEnabled) return requested;
		} else if (
			!isDisabledMorePanel(requested) &&
			panelsForKind(kind).includes(requested)
		) {
			return requested;
		}
	}
	// Product rule: the backend is the main content of a project, so Database opens first.
	// Analytics is listed for every kind, so it is a valid fallback while the gate is closed.
	return isCloudTabEnabled ? "database" : "analytics";
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

/**
 * Expo Go username of the last visit, or "" when none is stored, the value
 * is not a valid username, or storage fails. The QR panel sends it at mint.
 */
export function readExpoUsername(): string {
	try {
		// A user or an extension can put any text in storage; the API accepts only the schema.
		const stored = expoUsernameSchema.safeParse(
			window.localStorage.getItem(EXPO_GO_USERNAME_STORAGE_KEY),
		);
		return stored.success ? stored.data : "";
	} catch {
		return "";
	}
}

/** Stores the Expo Go username; "" removes it. A storage failure is not an error for the user. */
export function writeExpoUsername(expoUsername: string): void {
	try {
		if (expoUsername === "") {
			window.localStorage.removeItem(EXPO_GO_USERNAME_STORAGE_KEY);
		} else {
			window.localStorage.setItem(EXPO_GO_USERNAME_STORAGE_KEY, expoUsername);
		}
	} catch {
		// Private mode or a full quota: the username only lasts the session.
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

/**
 * The iframe src for one page of the app: the signed preview URL with the
 * path, query, and hash of `path`. Only those parts move, so the origin and
 * the `wt` token of the preview URL stay. `/` returns the URL unchanged.
 */
export function previewSrcFor(previewUrl: string, path: string): string {
	if (path === "/") return previewUrl;
	const url = new URL(previewUrl);
	// The base only lets the URL parser read a relative path. Its origin is never used.
	const target = new URL(path, "https://preview.invalid");
	url.pathname = target.pathname;
	// append keeps the token first, and the proxy reads the first `wt`.
	for (const [name, value] of target.searchParams) {
		url.searchParams.append(name, value);
	}
	url.hash = target.hash;
	return url.toString();
}
