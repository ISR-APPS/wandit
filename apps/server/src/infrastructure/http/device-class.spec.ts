import { describe, expect, it } from "vitest";

import { classifyDeviceFromUserAgent } from "./device-class";

describe("classifyDeviceFromUserAgent", () => {
	it.each([
		{
			expected: "tablet",
			name: "iPad",
			userAgent:
				"Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
		},
		{
			expected: "tablet",
			name: "Android tablet without Mobile",
			userAgent:
				"Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
		},
		{
			expected: "tablet",
			name: "explicit Tablet token",
			userAgent: "ExampleBrowser/1.0 Tablet Mobi",
		},
		{
			expected: "mobile",
			name: "Android phone",
			userAgent:
				"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36",
		},
		{
			expected: "mobile",
			name: "iPhone",
			userAgent:
				"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
		},
		{
			expected: "desktop",
			name: "desktop",
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
		},
	] as const)("classifies a $name user-agent", ({ expected, userAgent }) => {
		expect(classifyDeviceFromUserAgent(userAgent)).toBe(expected);
	});

	it.each([
		undefined,
		null,
		"",
		"   ",
	])("returns null for a missing or empty user-agent (%j)", (userAgent) => {
		expect(classifyDeviceFromUserAgent(userAgent)).toBeNull();
	});
});
