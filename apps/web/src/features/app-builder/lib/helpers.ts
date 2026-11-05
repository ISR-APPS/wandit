/**
 * Pure helpers of the app builder, with no React. Three list and test the
 * panels of the More view and pick the open one. Five pairs store the open
 * state and the split layout of the chat column, the chat view of local dev,
 * the Expo Go username, and the model pick. Two pair a model with its Fast
 * variant for the model menu. One copies text to the clipboard. One puts an
 * app page path on the signed preview URL. Two convert the spending limits
 * between the Settings fields and the API. One formats a USD amount of the
 * chat cost. Two serve the Thème sheet: the drop rule of its draft and the
 * brand color field. One fits the phone or the desktop window into its stage.
 * One tells the build queries that a live build ended. Called by the page,
 * the More view and its nav, the Settings panel, the chat cards, the Expo Go
 * popover, the preview panel, the web preview, the phone and desktop window
 * stages, the Thème sheet, the model menu, the model pick hook, the mobile
 * and desktop build queries, and the create flow.
 */

import {
	type BuilderModelsResponse,
	centiCreditsToCredits,
	creditsToCentiCredits,
	expoUsernameSchema,
	type LlmModelPrice,
	type UpdateProjectCostCapsRequest,
	updateProjectCostCapsRequestSchema,
} from "@wandit/contracts";
import type { AppThemeFile } from "@wandit/contracts/v2/app-theme";
import type { Locale } from "@wandit/internationalization";

import type { AppProjectKind } from "../api/dto";
import {
	BUILDER_MODEL_STORAGE_KEY_PREFIX,
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
import type { ElementSize } from "./use-element-size";

/** More panels the nav lists for a project kind, in nav order. */
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

/**
 * The panel the More view opens for the `?panel=` request. A Cloud panel
 * opens only while the Cloud gate is open. A panel the kind does not have,
 * or no request, opens the fallback panel.
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
		} else if (panelsForKind(kind).includes(requested)) {
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

/**
 * Model of the next turn for a project, or for the next new project when
 * `projectId` is null. The stored pick wins when `list` still has it, then
 * the deploy default. Undefined sends no model: the server picks its default.
 */
export function readBuilderModel(
	projectId: string | null,
	list: BuilderModelsResponse,
): string | undefined {
	// The API refuses an id without a price row, so only a listed id is sent.
	const isListed = (modelId: string | null): modelId is string =>
		modelId !== null && list.models.some((model) => model.modelId === modelId);
	let stored: string | null;
	try {
		stored = window.localStorage.getItem(builderModelStorageKey(projectId));
	} catch {
		// Private mode can block storage. The default model then runs.
		stored = null;
	}
	if (isListed(stored)) return stored;
	return isListed(list.defaultModel) ? list.defaultModel : undefined;
}

/** Stores the model pick of a project, or of the next new project when `projectId` is null. A storage failure is not an error for the user. */
export function writeBuilderModel(
	projectId: string | null,
	modelId: string,
): void {
	try {
		window.localStorage.setItem(builderModelStorageKey(projectId), modelId);
	} catch {
		// Private mode or a full quota: the pick only lasts the session.
	}
}

/** Storage key of one model pick. The read and the write must use the same key, so both call this. */
function builderModelStorageKey(projectId: string | null): string {
	return `${BUILDER_MODEL_STORAGE_KEY_PREFIX}${projectId ?? "new"}`;
}

// The Vercel AI Gateway names every Fast variant `<base id>-fast`, for example `zai/glm-5.3-fast`.
const FAST_MODEL_ID_SUFFIX = "-fast";

/**
 * Fast variant row of a listed model: the row `<modelId>-fast`, or undefined.
 * The model menu shows its lightning toggle only when this row exists.
 */
export function fastModelOf(
	models: readonly LlmModelPrice[],
	modelId: string,
): LlmModelPrice | undefined {
	const fastModelId = `${modelId}${FAST_MODEL_ID_SUFFIX}`;
	return models.find((model) => model.modelId === fastModelId);
}

/**
 * Base model id of a pick: `<X>` for `<X>-fast` when `<X>` is listed too, else
 * the pick. An orphan `-fast` row, for example `moonshotai/kimi-k3-fast`, is its
 * own base.
 */
export function baseModelIdOf(
	models: readonly LlmModelPrice[],
	modelId: string,
): string {
	if (!modelId.endsWith(FAST_MODEL_ID_SUFFIX)) return modelId;
	const baseModelId = modelId.slice(0, -FAST_MODEL_ID_SUFFIX.length);
	return models.some((model) => model.modelId === baseModelId)
		? baseModelId
		: modelId;
}

/** 1 USD in the unit of the chat cost route. */
const USD_MICROS_PER_USD = 1_000_000;

/**
 * USD text of an amount in USD micros. Below 1 dollar it shows 4 decimals,
 * so a cheap chat does not read $0.00. From 1 dollar it shows 2 decimals.
 */
export function formatUsdMicros(usdMicros: number, locale: Locale): string {
	// 100 micros are 0.0001 USD, and 10,000 of those are 1 USD. The rounded
	// value decides, so 0.99996 USD shows as $1.00, not $1.0000.
	const tenThousandthsOfUsd = Math.round(usdMicros / 100);
	const fractionDigits = tenThousandthsOfUsd < 10_000 ? 4 : 2;
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	}).format(usdMicros / USD_MICROS_PER_USD);
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

/**
 * The draft theme of the Thème sheet. `theme` shows in the preview iframe. `basedOn` is the saved
 * theme.json of the theme query when the user made the draft.
 */
export type ThemeDraft = { theme: AppThemeFile; basedOn: AppThemeFile };

/**
 * True when the draft must go: a turn runs, or the saved theme.json changed under it.
 * The files compare by reference. After THEME_HEAD_MOVED, the refetch can answer an equal file.
 * Structural sharing of TanStack Query then keeps the old object, so the draft stays.
 */
export function isThemeDraftStale(input: {
	draft: ThemeDraft;
	/** The `theme` of the theme query now. Undefined while the query has no data. */
	savedTheme: AppThemeFile | undefined;
	isTurnRunning: boolean;
}): boolean {
	return input.isTurnRunning || input.draft.basedOn !== input.savedTheme;
}

/** Six hex digits, with or without the leading "#". Case does not matter. */
const BRAND_HEX_TEXT = /^#?([0-9a-f]{6})$/i;

/**
 * The brand color that the user typed, in the `#rrggbb` lower-case form of the theme schema.
 * null for any other text, for example "#fff" or "blue".
 */
export function brandHexOf(text: string): `#${string}` | null {
	const digits = BRAND_HEX_TEXT.exec(text.trim())?.[1];
	return digits === undefined ? null : `#${digits.toLowerCase()}`;
}

/** Smallest scale of a fitted frame. A collapsed stage must not flip the frame with a negative scale. */
const MIN_FRAME_SCALE = 0.1;

/**
 * Scale that fits a frame of fixed design size into a stage, with `paddingPx` free on each side.
 * At most 1: the frame never grows past its design size. The phone and desktop window stages call it.
 */
export function fitFrameScale(
	stageSize: ElementSize | null,
	frameSize: ElementSize,
	paddingPx: number,
): number {
	// A stage without a size (not laid out yet) keeps the design size.
	if (stageSize === null || stageSize.width <= 0) return 1;
	return Math.max(
		Math.min(
			1,
			(stageSize.width - 2 * paddingPx) / frameSize.width,
			(stageSize.height - 2 * paddingPx) / frameSize.height,
		),
		MIN_FRAME_SCALE,
	);
}

/**
 * True when a build that is live in the cached answer has ended in the fresh answer.
 * The mobile and desktop build queries then refresh the credits: a build end settles or returns its held credits.
 * No cached answer gives false.
 */
export function hasEndedLiveBuild<Status extends string>(
	cachedBuilds: readonly { id: string; status: Status }[] | undefined,
	freshBuilds: readonly { id: string; status: Status }[],
	liveStatuses: ReadonlySet<Status>,
): boolean {
	const liveIds = new Set(
		cachedBuilds
			?.filter((build) => liveStatuses.has(build.status))
			.map((build) => build.id),
	);
	return freshBuilds.some(
		(build) => liveIds.has(build.id) && !liveStatuses.has(build.status),
	);
}
