import { describe, expect, it } from "vitest";

import {
	cssColorToHex,
	isFullyTransparentCssColor,
	normalizeHex,
} from "./contrast";

describe("cssColorToHex", () => {
	it("normalizes short and alpha hex colors", () => {
		expect(normalizeHex("#AbC8")).toBe("#aabbcc");
		expect(cssColorToHex("#ABCDEF80")).toBe("#abcdef");
	});

	it("converts legacy and modern rgb syntax", () => {
		expect(cssColorToHex("rgba(12, 34, 56, 0.4)")).toBe("#0c2238");
		expect(cssColorToHex("rgb(100% 50% 0% / 25%)")).toBe("#ff8000");
	});

	it("converts hsl and oklch token colors", () => {
		expect(cssColorToHex("hsl(120deg 100% 25%)")).toBe("#008000");
		expect(cssColorToHex("oklch(62.8% 0.2577 29.23)")).toBe("#ff0000");
	});

	it("returns null for values that cannot seed a native color input", () => {
		expect(cssColorToHex("var(--brand-color)")).toBeNull();
		expect(cssColorToHex("not-a-color")).toBeNull();
	});
});

describe("isFullyTransparentCssColor", () => {
	it("detects explicit zero alpha without treating translucent colors as empty", () => {
		expect(isFullyTransparentCssColor("rgba(0, 0, 0, 0)")).toBe(true);
		expect(isFullyTransparentCssColor("rgb(0 0 0 / 0%)")).toBe(true);
		expect(isFullyTransparentCssColor("#1230")).toBe(true);
		expect(isFullyTransparentCssColor("transparent")).toBe(true);
		expect(isFullyTransparentCssColor("rgba(0, 0, 0, 0.2)")).toBe(false);
		expect(isFullyTransparentCssColor("#1234")).toBe(false);
	});
});
