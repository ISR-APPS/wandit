// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHAT_LAYOUT_STORAGE_KEY } from "./constants";
import {
	copyToClipboard,
	panelsForKind,
	readChatLayout,
	readChatOpen,
	resolveMorePanel,
	writeChatLayout,
	writeChatOpen,
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

	it("keeps the nav order and starts with analytics for every kind", () => {
		expect(panelsForKind("web")[0]).toBe("analytics");
		expect(panelsForKind("mobile")[0]).toBe("analytics");
		expect(panelsForKind("web").at(-1)).toBe("settings");
	});
});

describe("resolveMorePanel", () => {
	it("keeps a panel the kind has", () => {
		expect(resolveMorePanel("web", "payments")).toBe("payments");
	});

	it("falls back to the first panel when the kind does not have it", () => {
		expect(resolveMorePanel("mobile", "domains")).toBe("analytics");
		expect(resolveMorePanel("web", "appStores")).toBe("analytics");
	});

	it("falls back to the first panel when nothing is requested", () => {
		expect(resolveMorePanel("web", undefined)).toBe("analytics");
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
