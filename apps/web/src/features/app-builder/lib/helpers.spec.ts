// @vitest-environment jsdom

import type { BuilderModelsResponse } from "@wandit/contracts";
import {
	APP_THEME_TEMPLATE_SELECTION,
	type AppThemeSource,
	buildAppThemeFile,
} from "@wandit/contracts/v2/app-theme";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	BUILDER_MODEL_STORAGE_KEY_PREFIX,
	BUILDER_THINKING_STORAGE_KEY_PREFIX,
	CHAT_LAYOUT_STORAGE_KEY,
	EXPO_GO_USERNAME_STORAGE_KEY,
} from "./constants";
import {
	baseModelIdOf,
	brandHexOf,
	copyToClipboard,
	costCapToDraft,
	fastModelOf,
	formatUsdMicros,
	hasThinkingControl,
	isSameThemeSource,
	isThemeDraftStale,
	lockedTurnModelOf,
	openChatOf,
	panelsForKind,
	previewSrcFor,
	readBuilderModel,
	readBuilderThinking,
	readChatLayout,
	readChatOpen,
	readExpoUsername,
	resolvePanel,
	toCostCapsBody,
	typicalTurnCostRatio,
	writeChatLayout,
	writeChatOpen,
	writeExpoUsername,
} from "./helpers";

describe("openChatOf", () => {
	const olderChat = {
		id: crypto.randomUUID(),
		title: "Build a shop",
		createdAt: "2026-11-01T08:00:00.000Z",
		lastMessageAt: "2026-11-01T08:05:00.000Z",
		model: "zai/glm-5.3",
	};
	const newerChat = {
		id: crypto.randomUUID(),
		title: null,
		createdAt: "2026-11-05T08:00:00.000Z",
		lastMessageAt: null,
		model: null,
	};
	// The API sorts the list by activity. The newer conversation has none, so its creation date counts.
	const chats = [newerChat, olderChat];

	it.each([
		{
			request: "an id that the list holds",
			chats,
			requestedChatId: olderChat.id,
			expected: {
				id: olderChat.id,
				isOldest: true,
				lockedModelId: "zai/glm-5.3",
			},
		},
		{
			request: "an id that the list does not hold",
			chats,
			requestedChatId: crypto.randomUUID(),
			expected: { id: newerChat.id, isOldest: false, lockedModelId: null },
		},
		{
			request: "no id",
			chats,
			requestedChatId: undefined,
			expected: { id: newerChat.id, isOldest: false, lockedModelId: null },
		},
		{
			request: "an empty list",
			chats: [],
			requestedChatId: olderChat.id,
			expected: null,
		},
	])("opens the right conversation for $request", ({
		chats: listed,
		requestedChatId,
		expected,
	}) => {
		expect(openChatOf(listed, requestedChatId)).toEqual(expected);
	});
});

describe("panelsForKind", () => {
	it("lists domains for a web app and not app stores", () => {
		const panels = panelsForKind("web");
		expect(panels).toContain("domains");
		expect(panels).not.toContain("appStores");
	});

	it("lists app stores for a mobile app and not domains", () => {
		const panels = panelsForKind("mobile");
		expect(panels).toContain("appStores");
		expect(panels).not.toContain("domains");
	});
});

describe("resolvePanel", () => {
	it("keeps a More panel the kind has, with the Cloud gate open or closed", () => {
		expect(resolvePanel("web", "payments", true)).toBe("payments");
		expect(resolvePanel("mobile", "appStores", false)).toBe("appStores");
	});

	it("keeps a Cloud panel only while the Cloud gate is open", () => {
		expect(resolvePanel("web", "logs", true)).toBe("logs");
		expect(resolvePanel("web", "logs", false)).toBe("analytics");
	});

	it("opens Database with the gate open and Analytics with it closed when nothing is requested", () => {
		expect(resolvePanel("web", undefined, true)).toBe("database");
		expect(resolvePanel("mobile", undefined, false)).toBe("analytics");
	});

	it("falls back for a panel the kind does not have", () => {
		expect(resolvePanel("mobile", "domains", false)).toBe("analytics");
		expect(resolvePanel("web", "appStores", true)).toBe("database");
	});
});

describe("chat pane storage", () => {
	const original = Object.getOwnPropertyDescriptor(window, "localStorage");
	const values = new Map<string, string>();
	// A Map-backed stand-in for the browser storage: Node 25 ships a stub without `clear`.
	const fakeStorage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
	};

	beforeEach(() => {
		values.clear();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: fakeStorage,
		});
	});

	afterEach(() => {
		if (original) Object.defineProperty(window, "localStorage", original);
	});

	it("is open when nothing is stored", () => {
		expect(readChatOpen()).toBe(true);
	});

	it("reads back what was written", () => {
		writeChatOpen(false);
		expect(readChatOpen()).toBe(false);
		writeChatOpen(true);
		expect(readChatOpen()).toBe(true);
	});

	it("stays open and does not throw when storage is blocked", () => {
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			get() {
				throw new Error("blocked");
			},
		});
		expect(() => writeChatOpen(false)).not.toThrow();
		expect(readChatOpen()).toBe(true);
		expect(() => writeChatLayout({ chat: 30, main: 70 })).not.toThrow();
		expect(readChatLayout()).toBeUndefined();
	});

	it("reads back the split layout it wrote", () => {
		writeChatLayout({ chat: 30, main: 70 });
		expect(readChatLayout()).toEqual({ chat: 30, main: 70 });
	});

	it("ignores a stored layout that is not a map of numbers", () => {
		fakeStorage.setItem(CHAT_LAYOUT_STORAGE_KEY, "{oops");
		expect(readChatLayout()).toBeUndefined();
		fakeStorage.setItem(
			CHAT_LAYOUT_STORAGE_KEY,
			JSON.stringify({ chat: "wide" }),
		);
		expect(readChatLayout()).toBeUndefined();
	});
});

describe("Expo Go username storage", () => {
	const original = Object.getOwnPropertyDescriptor(window, "localStorage");
	const values = new Map<string, string>();
	// The same Map-backed stand-in as the chat pane storage cases, with removeItem.
	const fakeStorage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
		removeItem: (key: string) => {
			values.delete(key);
		},
	};

	beforeEach(() => {
		values.clear();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: fakeStorage,
		});
	});

	afterEach(() => {
		if (original) Object.defineProperty(window, "localStorage", original);
	});

	it("reads back the name it wrote, and an empty write removes it", () => {
		expect(readExpoUsername()).toBe("");
		writeExpoUsername("zack_dev");
		expect(readExpoUsername()).toBe("zack_dev");
		writeExpoUsername("");
		expect(values.has(EXPO_GO_USERNAME_STORAGE_KEY)).toBe(false);
		expect(readExpoUsername()).toBe("");
	});

	it("ignores a stored value that the API would reject", () => {
		fakeStorage.setItem(EXPO_GO_USERNAME_STORAGE_KEY, "bad name");
		expect(readExpoUsername()).toBe("");
	});

	it("reads an empty name and does not throw when storage is blocked", () => {
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			get() {
				throw new Error("blocked");
			},
		});
		expect(() => writeExpoUsername("zack")).not.toThrow();
		expect(readExpoUsername()).toBe("");
	});
});

const priceRow = (modelId: string) => ({
	provider: "anthropic",
	modelId,
	inputUsdPerMTok: 1,
	outputUsdPerMTok: 5,
	cacheReadUsdPerMTok: 0.1,
	cacheWriteUsdPerMTok: 2,
});

describe("readBuilderModel", () => {
	const original = Object.getOwnPropertyDescriptor(window, "localStorage");
	const values = new Map<string, string>();
	const PROJECT_ID = "6f1c2a52-8f3e-4b9a-9d55-0c6f6c1e2a10";
	const STANDARD = "deepseek/deepseek-v4.1-flash-1017";
	const list: BuilderModelsResponse = {
		defaultModel: "anthropic/claude-opus-5.5",
		models: [
			priceRow(STANDARD),
			priceRow(`${STANDARD}-fast`),
			priceRow("anthropic/claude-opus-5.5"),
			priceRow("google/gemini-4-hydrogen"),
		],
	};

	beforeEach(() => {
		values.clear();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: { getItem: (key: string) => values.get(key) ?? null },
		});
	});

	afterEach(() => {
		if (original) Object.defineProperty(window, "localStorage", original);
	});

	// Only a tier model or its Fast row survives. Anything else falls back to the first tier, never to the server default.
	it.each([
		[
			"a tier pick",
			"anthropic/claude-opus-5.5",
			"anthropic/claude-opus-5.5",
			list,
		],
		["the Fast row of a tier", `${STANDARD}-fast`, `${STANDARD}-fast`, list],
		[
			"a listed pick outside the tiers",
			STANDARD,
			"google/gemini-4-hydrogen",
			list,
		],
		["an unknown pick", STANDARD, "openai/removed", list],
		[
			"no pick and no listed tier",
			undefined,
			null,
			{ ...list, models: [priceRow("google/gemini-4-hydrogen")] },
		],
	])("reads %s as %j", (_, expected, stored, models) => {
		if (stored !== null) {
			values.set(`${BUILDER_MODEL_STORAGE_KEY_PREFIX}${PROJECT_ID}`, stored);
		}
		expect(readBuilderModel(PROJECT_ID, models)).toBe(expected);
	});

	it("reads the first tier when storage is blocked", () => {
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			get() {
				throw new Error("blocked");
			},
		});
		expect(readBuilderModel(null, list)).toBe(STANDARD);
	});
});

describe("readBuilderThinking", () => {
	const original = Object.getOwnPropertyDescriptor(window, "localStorage");
	const values = new Map<string, string>();

	beforeEach(() => {
		values.clear();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: { getItem: (key: string) => values.get(key) ?? null },
		});
	});

	afterEach(() => {
		if (original) Object.defineProperty(window, "localStorage", original);
	});

	// The old control stored "normal". The API refuses it, so it must read as the default level.
	it.each([
		["the old two-level value as balanced", "normal", "balanced"],
		["a current level as itself", "deep", "deep"],
		["no stored value as balanced", null, "balanced"],
	])("reads %s", (_, stored, expected) => {
		if (stored !== null) {
			values.set(`${BUILDER_THINKING_STORAGE_KEY_PREFIX}new`, stored);
		}
		expect(readBuilderThinking(null)).toBe(expected);
	});
});

describe("typicalTurnCostRatio", () => {
	// Rates in USD per million tokens. The typical turn is 60k input, 12k output, 180k cache reads, 20k cache writes.
	const rates = (
		modelId: string,
		input: number,
		output: number,
		cacheRead: number,
		cacheWrite: number,
	) => ({
		provider: "test",
		modelId,
		inputUsdPerMTok: input,
		outputUsdPerMTok: output,
		cacheReadUsdPerMTok: cacheRead,
		cacheWriteUsdPerMTok: cacheWrite,
	});
	// The typical turn costs 0.03966 USD on the base: 0.018 + 0.0144 + 0.00126 + 0.006.
	const base = rates("base", 0.3, 1.2, 0.007, 0.3);
	const models = [
		base,
		// 0.2235 USD: 5.635x the base, one decimal.
		rates("high", 1.5, 7.5, 0.075, 1.5),
		// 0.676 USD: 17.04x the base, a whole number from 10.
		rates("nuclear", 4, 20, 0.2, 8),
		// 9.96x the base rounds to 10.0, so it shows as a whole number.
		rates("almost-ten", 2.988, 11.952, 0.06972, 2.988),
		// Its long-context rates apply: the 260k prompt is above 200k. They are 4x the base rates.
		{
			...base,
			modelId: "long",
			longContext: {
				aboveTokens: 200_000,
				inputUsdPerMTok: 1.2,
				outputUsdPerMTok: 4.8,
				cacheReadUsdPerMTok: 0.028,
				cacheWriteUsdPerMTok: 1.2,
			},
		},
		// A long-context threshold above the 260k prompt keeps the normal rates.
		{
			...base,
			modelId: "long-unused",
			longContext: {
				aboveTokens: 272_000,
				inputUsdPerMTok: 1.2,
				outputUsdPerMTok: 4.8,
				cacheReadUsdPerMTok: 0.028,
				cacheWriteUsdPerMTok: 1.2,
			},
		},
		rates("free", 0, 0, 0, 0),
	];

	it.each([
		["a tier under 10x", "high", "base", 5.6],
		["a tier from 10x", "nuclear", "base", 17],
		["a ratio that rounds up to 10", "almost-ten", "base", 10],
		["a row with long-context rates", "long", "base", 4],
		["a row under its long-context threshold", "long-unused", "base", 1],
		["a row the list does not hold", "removed", "base", undefined],
		["a base the list does not hold", "high", "removed", undefined],
		["a base that costs nothing", "high", "free", undefined],
	])("gives the ratio of %s", (_, modelId, baseModelId, expected) => {
		expect(typicalTurnCostRatio(models, modelId, baseModelId)).toBe(expected);
	});
});

describe("baseModelIdOf and fastModelOf", () => {
	const models = [
		priceRow("anthropic/claude-opus-5.5"),
		priceRow("anthropic/claude-opus-5.5-fast"),
		priceRow("moonshotai/kimi-k3-fast"),
		priceRow("google/gemini-4-argon"),
	];

	// A "-fast" row pairs with its base only when the base row is listed too.
	it.each([
		[
			"a Fast pick",
			"anthropic/claude-opus-5.5-fast",
			"anthropic/claude-opus-5.5",
			"anthropic/claude-opus-5.5-fast",
		],
		[
			"an orphan Fast row",
			"moonshotai/kimi-k3-fast",
			"moonshotai/kimi-k3-fast",
			undefined,
		],
		[
			"a model without Fast",
			"google/gemini-4-argon",
			"google/gemini-4-argon",
			undefined,
		],
	])("maps %s to its base row and Fast row", (_, pickId, baseId, fastId) => {
		const base = baseModelIdOf(models, pickId);
		expect(base).toBe(baseId);
		expect(fastModelOf(models, base)?.modelId).toBe(fastId);
	});
});

describe("hasThinkingControl", () => {
	const STANDARD = "deepseek/deepseek-v4.1-flash-1017";
	const HIGH = "zai/glm-5.3";
	const models = [
		priceRow(STANDARD),
		priceRow(`${STANDARD}-fast`),
		priceRow(HIGH),
		priceRow(`${HIGH}-fast`),
		priceRow("google/gemini-4-hydrogen"),
	];

	// The page sends a level only on true, and Deep costs more credits.
	it.each([
		["a High pick", models, HIGH, true],
		["a High Fast pick", models, `${HIGH}-fast`, true],
		["a Standard pick", models, STANDARD, false],
		["a Standard Fast pick", models, `${STANDARD}-fast`, false],
		["a model outside the tiers", models, "google/gemini-4-hydrogen", false],
		["no model pick: the picker hides", models, undefined, false],
		["a list that is not loaded", undefined, HIGH, false],
	])("answers for %s", (_, list, modelId, expected) => {
		expect(hasThinkingControl(list, modelId)).toBe(expected);
	});
});

describe("lockedTurnModelOf", () => {
	const STANDARD = "deepseek/deepseek-v4.1-flash-1017";
	const NUCLEAR = "anthropic/claude-opus-5.5";
	const models = [
		priceRow(STANDARD),
		priceRow(NUCLEAR),
		priceRow(`${NUCLEAR}-fast`),
	];

	// Fast costs more and another tier answers 409, so the sent id must follow the switch inside the tier.
	it.each([
		[
			"no switch keeps the Fast lock",
			models,
			`${NUCLEAR}-fast`,
			undefined,
			`${NUCLEAR}-fast`,
		],
		["Fast on picks the Fast row", models, NUCLEAR, true, `${NUCLEAR}-fast`],
		[
			"Fast off goes back to the tier model",
			models,
			`${NUCLEAR}-fast`,
			false,
			NUCLEAR,
		],
		[
			"Fast on without a Fast row keeps the tier model",
			models,
			STANDARD,
			true,
			STANDARD,
		],
		[
			"a list that is not loaded keeps the lock",
			undefined,
			NUCLEAR,
			true,
			NUCLEAR,
		],
	])("%s", (_, list, lockedModelId, isFast, expected) => {
		expect(lockedTurnModelOf(list, lockedModelId, isFast)).toBe(expected);
	});
});

describe("formatUsdMicros", () => {
	// 1 USD = 1,000,000 micros. The rounded 4-decimal value picks 4 or 2 decimals.
	it.each([
		[1_234, "$0.0012"],
		[999_949, "$0.9999"],
		[999_950, "$1.00"],
		[12_345_678, "$12.35"],
	])("formats %i micros as %s", (usdMicros, text) => {
		expect(formatUsdMicros(usdMicros, "en")).toBe(text);
	});
});

describe("copyToClipboard", () => {
	afterEach(() => {
		Reflect.deleteProperty(navigator, "clipboard");
		vi.restoreAllMocks();
	});

	it("writes the text and returns true", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});
		expect(await copyToClipboard("+ const a = 1;")).toBe(true);
		expect(writeText).toHaveBeenCalledWith("+ const a = 1;");
	});

	it("logs and returns false when the browser has no clipboard", async () => {
		// jsdom has no navigator.clipboard, so the write throws inside the try.
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await copyToClipboard("text")).toBe(false);
		expect(errorSpy).toHaveBeenCalledOnce();
	});
});

describe("previewSrcFor", () => {
	const previewUrl = "https://r-abcdef123456--p-p1.wanditpreview.app/?wt=t1";

	// The path comes from the route picker or from a message of the app frame. The origin and the token must never change.
	it.each([
		["/", previewUrl],
		["/login", "https://r-abcdef123456--p-p1.wanditpreview.app/login?wt=t1"],
		[
			"/posts?tab=new#top",
			"https://r-abcdef123456--p-p1.wanditpreview.app/posts?wt=t1&tab=new#top",
		],
		[
			"//evil.example/steal",
			"https://r-abcdef123456--p-p1.wanditpreview.app/steal?wt=t1",
		],
		[
			"https://evil.example/x?wt=stolen",
			"https://r-abcdef123456--p-p1.wanditpreview.app/x?wt=t1&wt=stolen",
		],
	])("%s gives %s", (path, src) => {
		expect(previewSrcFor(previewUrl, path)).toBe(src);
	});
});

describe("toCostCapsBody", () => {
	// The fields hold credits with at most 2 decimals; the API stores centi-credits (1 credit = 100 cc).
	it.each([
		["50", "", { perTurnCapCredits: 5_000, monthlyCapCredits: null }],
		["", " 1000 ", { perTurnCapCredits: null, monthlyCapCredits: 100_000 }],
		["2500", "", { perTurnCapCredits: 250_000, monthlyCapCredits: null }],
		["2501", "", null],
		["0", "", null],
		["", "-3", null],
		["1.5", "123.45", { perTurnCapCredits: 150, monthlyCapCredits: 12_345 }],
		["0.01", "", { perTurnCapCredits: 1, monthlyCapCredits: null }],
		["1.234", "", null],
		["", "21474836.48", null],
		["", "ten", null],
		["", "1e3", null],
	])("turns %j and %j into %j", (perTurnCredits, monthlyCredits, body) => {
		expect(toCostCapsBody({ perTurnCredits, monthlyCredits })).toEqual(body);
	});

	it("reads back a stored part-credit cap as a valid field text", () => {
		expect(costCapToDraft(12_345)).toBe("123.45");
		expect(costCapToDraft(null)).toBe("");
		expect(
			toCostCapsBody({
				perTurnCredits: costCapToDraft(12_345),
				monthlyCredits: costCapToDraft(null),
			}),
		).toEqual({ perTurnCapCredits: 12_345, monthlyCapCredits: null });
	});
});

describe("isThemeDraftStale", () => {
	const saved = buildAppThemeFile({
		selection: APP_THEME_TEMPLATE_SELECTION,
		origin: "template",
	});
	const draft = {
		theme: buildAppThemeFile({
			selection: { ...APP_THEME_TEMPLATE_SELECTION, mode: "dark" },
			origin: "user",
		}),
		basedOn: saved,
	};

	// A kept stale draft shows a theme in the preview that Save would write over a newer file.
	it.each([
		["the same saved file and no turn", false, saved, false],
		["a running turn", true, saved, true],
		["no saved file", true, undefined, false],
	])("with %s, drops the draft: %s", (_case, isStale, savedTheme, isTurnRunning) => {
		expect(isThemeDraftStale({ draft, savedTheme, isTurnRunning })).toBe(
			isStale,
		);
	});
});

describe("isSameThemeSource", () => {
	const seeds = {
		kind: "seeds",
		background: "#ffffff",
		foreground: "#111111",
		primary: "#1f6098",
	} satisfies AppThemeSource;
	const ardoise: AppThemeSource = { kind: "look", look: "ardoise" };
	// A wrong answer keeps an old name after a new look, or drops the AI name after a radius change.
	it.each<[string, boolean, AppThemeSource, AppThemeSource]>([
		["the same look", true, ardoise, { kind: "look", look: "ardoise" }],
		["another look", false, ardoise, { kind: "look", look: "brume" }],
		[
			"the same world",
			true,
			{ kind: "world", world: "promenade" },
			{ kind: "world", world: "promenade" },
		],
		["equal seeds", true, seeds, { ...seeds }],
		[
			"seeds with another primary",
			false,
			seeds,
			{ ...seeds, primary: "#aa0000" },
		],
		["a look after seeds", false, seeds, ardoise],
	])("with %s, keeps the name: %s", (_case, isSame, current, next) => {
		expect(isSameThemeSource(current, next)).toBe(isSame);
	});
});

describe("brandHexOf", () => {
	// The theme schema takes only lower-case `#rrggbb`. Any other text must not reach the draft.
	it.each([
		["#1F6098", "#1f6098"],
		["1f6098", "#1f6098"],
		[" #a0b1c2 ", "#a0b1c2"],
		["#fff", null],
		["#1f60988", null],
		["#gg0000", null],
		["blue", null],
		["", null],
	])("reads %j as %j", (text, hex) => {
		expect(brandHexOf(text)).toBe(hex);
	});
});
