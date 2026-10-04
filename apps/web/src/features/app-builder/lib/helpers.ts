/**
 * Pure helpers of the app builder, with no React. Five list and test the
 * panels of the More view, pick the open one, and name it. Four pairs
 * store the open state and the split layout of the chat card, the chat view
 * of local dev, and the Expo Go username. One copies text to the clipboard.
 * Two convert the spending limits between the Settings fields and the API.
 * Called by the page, the More view and its nav, the Settings panel, the
 * chat cards, and the Expo Go popover.
 */

import {
	centiCreditsToCredits,
	creditsToCentiCredits,
	expoUsernameSchema,
	type UpdateProjectCostCapsRequest,
	updateProjectCostCapsRequestSchema,
} from "@wandit/contracts";

import type { TranslationKey } from "@/lib/i18n";
import type { AppProjectKind } from "../api/dto";
import {
	CHAT_LAYOUT_STORAGE_KEY,
	CHAT_OPEN_STORAGE_KEY,
	CHAT_VIEW_STORAGE_KEY,
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

/** True for an id of the Backend group. The More view renders those panels without PanelShell. */
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

/** Dictionary key of the panel title in the work bar. The Cloud labels live in the workspace dictionary (WANDIT-188). */
export function panelTitleKey(panel: ProjectPanel): TranslationKey {
	if (isCloudPanel(panel)) return `workspace.cloud.panels.${panel}`;
	return MORE_PANEL_META[panel].title;
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

/** True when the last visit chose the developer view of the chat. False when nothing is stored or storage fails. */
export function readDeveloperView(): boolean {
	try {
		return window.localStorage.getItem(CHAT_VIEW_STORAGE_KEY) === "developer";
	} catch {
		// Blocked storage: the default production view shows.
		return false;
	}
}

/** Stores the chat view choice of local dev. A storage failure is not an error for the user. */
export function writeDeveloperView(isDeveloperView: boolean): void {
	try {
		window.localStorage.setItem(
			CHAT_VIEW_STORAGE_KEY,
			isDeveloperView ? "developer" : "production",
		);
	} catch {
		// Private mode or a full quota: the view choice only lasts the session.
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

/** Text of a spending-limit field for one stored cap: credits with up to 2 decimals, or "" for no cap. */
export function costCapToDraft(centiCredits: number | null): string {
	return centiCredits === null
		? ""
		: String(centiCreditsToCredits(centiCredits));
}

/**
 * Turns the two spending-limit fields of Settings into the cost-caps body,
 * in centi-credits. Each field holds credits with at most 2 decimals, and ""
 * sends null: the default for the turn cap, no limit for the monthly cap.
 * null when a field holds another value, or a value outside the contract bounds.
 */
export function toCostCapsBody(draft: {
	/** Text of the per-turn field. */
	perTurnCredits: string;
	/** Text of the monthly field. */
	monthlyCredits: string;
}): UpdateProjectCostCapsRequest | null {
	const perTurnCapCredits = creditsTextToCap(draft.perTurnCredits);
	const monthlyCapCredits = creditsTextToCap(draft.monthlyCredits);
	if (perTurnCapCredits === undefined || monthlyCapCredits === undefined) {
		return null;
	}
	// The contract holds the API bounds, for example 250,000 cc at most per turn.
	const parsed = updateProjectCostCapsRequestSchema.safeParse({
		perTurnCapCredits,
		monthlyCapCredits,
	});
	return parsed.success ? parsed.data : null;
}

/** Digits with at most 2 decimals. The API unit is 1 centi-credit, which is 0.01 credit. */
const CREDITS_TEXT = /^\d+(\.\d{1,2})?$/;

/** "" gives null, a credit amount gives its centi-credits, any other text gives undefined. */
function creditsTextToCap(text: string): number | null | undefined {
	const trimmed = text.trim();
	if (trimmed === "") return null;
	if (!CREDITS_TEXT.test(trimmed)) return undefined;
	const centiCredits = creditsToCentiCredits(Number(trimmed));
	// A cap of 0 would stop every turn, so the contract asks for 1 cc at least.
	return centiCredits >= 1 ? centiCredits : undefined;
}
