// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	CHAT_LAYOUT_STORAGE_KEY,
	EXPO_GO_USERNAME_STORAGE_KEY,
} from "./constants";
import {
	copyToClipboard,
	costCapToDraft,
	panelsForKind,
	previewSrcFor,
	readChatLayout,
	readChatOpen,
	readExpoUsername,
	resolvePanel,
	toCostCapsBody,
	writeChatLayout,
	writeChatOpen,
	writeExpoUsername,
} from "./helpers";

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

	it("falls back for Integrations, which the nav shows as Soon", () => {
		expect(resolvePanel("web", "integrations", true)).toBe("database");
		expect(resolvePanel("web", "integrations", false)).toBe("analytics");
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
