/**
 * Pure helpers of the app builder, with no React. Three list and test the
 * panels of the More view and pick the open one. One picks the open
 * conversation. Five pairs store the open
 * state and the split layout of the chat column, the chat view of local dev,
 * the Expo Go username, and the model pick. One pair stores the thinking
 * pick, and one rule tells if the thinking control shows. Two pair a model
 * with its Fast variant for the model menu. Three serve the effort tiers of
 * the model slider: BUILDER_TIERS, visibleBuilderTiers, and builderTierOf.
 * One gives the cost ratio of a tier against Standard. One copies
 * text to the clipboard. One puts an app page path on the signed preview URL.
 * Two convert the spending limits between the Settings fields and the API.
 * One formats a USD amount of the chat cost. Three serve the Thème sheet:
 * the drop rule of its draft, the brand color field, and the name rule. One fits the phone or the desktop
 * window into its stage. One tells the build queries that a live build
 * ended. Called by the page, the More view and its nav, the Settings panel,
 * the chat cards, the Expo Go popover, the preview panel, the web preview,
 * the phone and desktop window stages, the Thème sheet, the model menu, the
 * model pick hook, the mobile and desktop build queries, and the create flow.
 */

import {
	type BuilderModelsResponse,
	type BuilderThinking,
	builderThinkingSchema,
	centiCreditsToCredits,
	creditsToCentiCredits,
	expoUsernameSchema,
	type LlmModelPrice,
	type ProjectChat,
	TYPICAL_TURN_USAGE,
	type UpdateProjectCostCapsRequest,
	updateProjectCostCapsRequestSchema,
} from "@wandit/contracts";
import type {
	AppThemeFile,
	AppThemeSource,
} from "@wandit/contracts/v2/app-theme";
import type { Locale } from "@wandit/internationalization";

import type { AppProjectKind } from "../api/dto";
import {
	BUILDER_MODEL_STORAGE_KEY_PREFIX,
	BUILDER_THINKING_STORAGE_KEY_PREFIX,
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

/** The conversation the builder shows. The page makes it with `openChatOf` and gives it to useBuilderThread. */
export type OpenChat = {
	/** Id of the conversation, a row id of `chats`. */
	id: string;
	/** True when no conversation of the project is older. Only that conversation can hold the first turn of the project. */
	isOldest: boolean;
	/**
	 * Model id of the newest turn with a model, from `projectChatSchema.model`:
	 * a tier model or its Fast row. Null before the first turn. A set id locks
	 * the tier: see lockedTurnModelOf.
	 */
	lockedModelId: string | null;
};

/**
 * The conversation the builder opens for the `?chat=` request. `chats` is
 * the conversation list of the project, the most recent activity first. An
 * id that the list does not hold, or no request, opens the first
 * conversation. Null while the list is empty, as during its load.
 */
export function openChatOf(
	chats: readonly ProjectChat[],
	requestedChatId: string | undefined,
): OpenChat | null {
	const chat = chats.find((row) => row.id === requestedChatId) ?? chats.at(0);
	if (chat === undefined) return null;
	const createdAtMs = Date.parse(chat.createdAt);
	return {
		id: chat.id,
		isOldest: chats.every((row) => Date.parse(row.createdAt) >= createdAtMs),
		lockedModelId: chat.model,
	};
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
 * `projectId` is null. The stored pick wins when it is a listed tier model or
 * its Fast row, then the first listed tier. Undefined sends no model: the
 * server picks its default.
 */
export function readBuilderModel(
	projectId: string | null,
	list: BuilderModelsResponse,
): string | undefined {
	let stored: string | null;
	try {
		stored = window.localStorage.getItem(
			pickStorageKey(BUILDER_MODEL_STORAGE_KEY_PREFIX, projectId),
		);
	} catch {
		// Private mode can block storage. The first tier then runs.
		stored = null;
	}
	// The API refuses an id without a price row, so only a listed id is sent.
	if (
		stored !== null &&
		list.models.some((model) => model.modelId === stored) &&
		builderTierOf(list.models, stored) !== undefined
	) {
		return stored;
	}
	// Product rule: Standard is the base tier. `V2_DEFAULT_MODEL` on the server must name Standard too.
	// A send with no model (no tier listed, list loading, or list failed) runs that server default.
	return visibleBuilderTiers(list.models)[0]?.modelId;
}

/** Stores the model pick of a project, or of the next new project when `projectId` is null. A storage failure is not an error for the user. */
export function writeBuilderModel(
	projectId: string | null,
	modelId: string,
): void {
	try {
		window.localStorage.setItem(
			pickStorageKey(BUILDER_MODEL_STORAGE_KEY_PREFIX, projectId),
			modelId,
		);
	} catch {
		// Private mode or a full quota: the pick only lasts the session.
	}
}

/**
 * Thinking pick of a project, or of the next new project when `projectId`
 * is null. "balanced" when nothing valid is stored or storage fails. A
 * stored "normal" of the old two-level control fails the parse, so it
 * reads as "balanced" too.
 */
export function readBuilderThinking(projectId: string | null): BuilderThinking {
	try {
		// A user or an extension can put any text in storage; the API accepts only the schema.
		const stored = builderThinkingSchema.safeParse(
			window.localStorage.getItem(
				pickStorageKey(BUILDER_THINKING_STORAGE_KEY_PREFIX, projectId),
			),
		);
		return stored.success ? stored.data : "balanced";
	} catch {
		// Private mode can block storage. The default level then runs.
		return "balanced";
	}
}

/** Stores the thinking pick of a project, or of the next new project when `projectId` is null. A storage failure is not an error for the user. */
export function writeBuilderThinking(
	projectId: string | null,
	thinking: BuilderThinking,
): void {
	try {
		window.localStorage.setItem(
			pickStorageKey(BUILDER_THINKING_STORAGE_KEY_PREFIX, projectId),
			thinking,
		);
	} catch {
		// Private mode or a full quota: the pick only lasts the session.
	}
}

/** Storage key of one pick of a project. The read and the write must use the same key, so both call this. */
function pickStorageKey(prefix: string, projectId: string | null): string {
	return `${prefix}${projectId ?? "new"}`;
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

/** Key of an effort tier. It picks the i18n strings and the color of the tier. */
export type BuilderTierId = "standard" | "high" | "max" | "nuclear";

/** One stop of the model slider. */
export type BuilderTier = {
	id: BuilderTierId;
	/** Gateway id of the base model, a row of `GET /api/v2/models`. Its `-fast` row, when listed, is the Fast mode. */
	modelId: string;
};

/**
 * Stops of the model slider, from the cheapest to the strongest. Zack picks
 * the models. The server price table must list each one, or the tier hides.
 * A chat that ran on an old tier model keeps it: lib/model-labels.ts still names it.
 */
export const BUILDER_TIERS: readonly BuilderTier[] = [
	{ id: "standard", modelId: "deepseek/deepseek-v4.1-flash-1017" },
	{ id: "high", modelId: "zai/glm-5.3" },
	{ id: "max", modelId: "google/gemini-4-neon" },
	{ id: "nuclear", modelId: "anthropic/claude-opus-5.5" },
];

/** The tiers whose model the server lists, in slider order. The slider and the pick fallback read only these. */
export function visibleBuilderTiers(
	models: readonly LlmModelPrice[],
): BuilderTier[] {
	return BUILDER_TIERS.filter((tier) =>
		models.some((model) => model.modelId === tier.modelId),
	);
}

/** Visible tier of a picked model id, the base row or its Fast row. Undefined for a model outside the tiers. */
export function builderTierOf(
	models: readonly LlmModelPrice[],
	modelId: string,
): BuilderTier | undefined {
	const baseModelId = baseModelIdOf(models, modelId);
	return visibleBuilderTiers(models).find(
		(tier) => tier.modelId === baseModelId,
	);
}

/**
 * True when the thinking control works for the model of the next turn,
 * and the page sends the thinking pick. False when the control shows disabled:
 * the list is not loaded, `modelId` is undefined, or the model has no tier.
 */
export function hasThinkingControl(
	models: readonly LlmModelPrice[] | undefined,
	modelId: string | undefined,
): boolean {
	// Deep costs more credits, so a level goes out only when the user sees the control enabled.
	if (models === undefined || modelId === undefined) return false;
	const tier = builderTierOf(models, modelId);
	// Product rule: Standard has no thinking control. Effort had no measured effect on its model.
	return tier !== undefined && tier.id !== "standard";
}

/**
 * Thinking level a turn or a project create sends. The builder page and the
 * dashboard call it. Undefined runs "balanced" on the server.
 */
export function sentThinkingOf(
	models: readonly LlmModelPrice[] | undefined,
	modelId: string | undefined,
	thinking: BuilderThinking,
): BuilderThinking | undefined {
	// Deep costs more credits, so the pick goes out only where the control shows it.
	return hasThinkingControl(models, modelId) ? thinking : undefined;
}

/**
 * Model id the next send of a locked conversation carries. `isFast`
 * undefined keeps `lockedModelId`. True picks the Fast row of its tier, false
 * the tier model. A tier without a Fast row sends the tier model.
 */
export function lockedTurnModelOf(
	models: readonly LlmModelPrice[] | undefined,
	lockedModelId: string,
	isFast: boolean | undefined,
): string {
	// Without the list no switch shows, so the conversation keeps its model.
	if (models === undefined || isFast === undefined) return lockedModelId;
	// Product rule: a locked conversation keeps its tier, but Fast mode can change on each message.
	const baseModelId = baseModelIdOf(models, lockedModelId);
	if (!isFast) return baseModelId;
	return fastModelOf(models, baseModelId)?.modelId ?? baseModelId;
}

// The ratio shows one decimal below this value and a whole number from it, so "≈ ×5.6" and "≈ ×17" stay short.
const COST_RATIO_WHOLE_FROM = 10;

/**
 * Cost of a typical turn (TYPICAL_TURN_USAGE) on `modelId`, divided by the
 * same cost on `baseModelId`. One decimal below 10, a whole number from 10.
 * Undefined when a row is not listed or the base costs nothing.
 */
export function typicalTurnCostRatio(
	models: readonly LlmModelPrice[],
	modelId: string,
	baseModelId: string,
): number | undefined {
	const price = models.find((model) => model.modelId === modelId);
	const basePrice = models.find((model) => model.modelId === baseModelId);
	if (price === undefined || basePrice === undefined) return undefined;
	const baseCost = typicalTurnCostOf(basePrice);
	if (baseCost === 0) return undefined;
	const ratio = typicalTurnCostOf(price) / baseCost;
	// The rounded value decides, so 9.96 shows as "10", not "10.0".
	const tenths = Math.round(ratio * 10) / 10;
	return tenths < COST_RATIO_WHOLE_FROM ? tenths : Math.round(ratio);
}

/**
 * Cost of one typical turn on a price row, in USD per million tokens times
 * tokens. Only ratios read it, so it skips the division by one million.
 * The long-context rule copies `priceUsdMicros` of the server price table.
 */
function typicalTurnCostOf(price: LlmModelPrice): number {
	const usage = TYPICAL_TURN_USAGE;
	// The provider picks the rate from the whole prompt, cached tokens included.
	const promptTokens =
		usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
	const rates =
		price.longContext !== undefined &&
		promptTokens > price.longContext.aboveTokens
			? price.longContext
			: price;
	return (
		usage.inputTokens * rates.inputUsdPerMTok +
		usage.outputTokens * rates.outputUsdPerMTok +
		usage.cacheReadTokens * rates.cacheReadUsdPerMTok +
		usage.cacheWriteTokens * rates.cacheWriteUsdPerMTok
	);
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

/**
 * True when two theme sources give the same palette: the same look, the same world, or the same three seeds.
 * The Thème sheet keeps the theme name, for example a name of the AI designer, only while the source stays.
 */
export function isSameThemeSource(
	current: AppThemeSource,
	next: AppThemeSource,
): boolean {
	switch (current.kind) {
		case "look":
			return next.kind === "look" && next.look === current.look;
		case "world":
			return next.kind === "world" && next.world === current.world;
		case "seeds":
			return (
				next.kind === "seeds" &&
				next.background === current.background &&
				next.foreground === current.foreground &&
				next.primary === current.primary
			);
	}
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
