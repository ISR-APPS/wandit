import { describe, expect, it } from "vitest";

import {
	isKeyKShortcut,
	nextBaseVersionAfterOwnSave,
	shouldDeferVersionChangeWhileSaving,
	shouldHandleWindowEscape,
	shouldShowSaveBar,
} from "./page-editor-state";

describe("nextBaseVersionAfterOwnSave", () => {
	it("rebases edits recorded after save onto the version that save produced", () => {
		expect(nextBaseVersionAfterOwnSave("v6", 1)).toBe("v6");
	});

	it("leaves a clean editor without a pinned base version", () => {
		expect(nextBaseVersionAfterOwnSave("v6", 0)).toBeNull();
	});
});

describe("shouldDeferVersionChangeWhileSaving", () => {
	it("defers classification while a save promise is in flight", () => {
		expect(shouldDeferVersionChangeWhileSaving(true)).toBe(true);
		expect(shouldDeferVersionChangeWhileSaving(false)).toBe(false);
	});
});

describe("shouldHandleWindowEscape", () => {
	it("ignores Escape already consumed by a dialog or dropdown layer", () => {
		expect(
			shouldHandleWindowEscape({ key: "Escape", defaultPrevented: true }),
		).toBe(false);
	});

	it("keeps the editor Escape ladder for unconsumed Escape", () => {
		expect(
			shouldHandleWindowEscape({ key: "Escape", defaultPrevented: false }),
		).toBe(true);
		expect(
			shouldHandleWindowEscape({ key: "Enter", defaultPrevented: false }),
		).toBe(false);
	});
});

describe("isKeyKShortcut", () => {
	it("recognizes the physical K key on Arabic keyboard layouts", () => {
		expect(isKeyKShortcut({ key: "ن", code: "KeyK" })).toBe(true);
		expect(isKeyKShortcut({ key: "K", code: "Unidentified" })).toBe(true);
		expect(isKeyKShortcut({ key: "x", code: "KeyJ" })).toBe(false);
	});
});

describe("shouldShowSaveBar", () => {
	it("hides active save and discard controls on a historical canvas", () => {
		expect(shouldShowSaveBar(3, true)).toBe(false);
	});

	it("shows controls only for pending changes on the latest canvas", () => {
		expect(shouldShowSaveBar(3, false)).toBe(true);
		expect(shouldShowSaveBar(0, false)).toBe(false);
	});
});
