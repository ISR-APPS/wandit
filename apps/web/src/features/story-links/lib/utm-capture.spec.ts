import { describe, expect, it, vi } from "vitest";

import {
	createUtmCapture,
	REFERRER_ATTRIBUTION_SENT_STORAGE_KEY,
	UTM_LAST_TOUCH_STORAGE_KEY,
} from "./utm-capture";

const CAPTURED_AT = new Date("2026-08-15T10:30:00.000Z");
const ORIGINAL_URL =
	"https://wandit.example/pricing?utm_source=instagram&utm_medium=story&utm_campaign=summer-launch&utm_content=hero&coupon=SAVE#plans";

type SetupOptions = {
	referrer?: string;
};

function setup(url = ORIGINAL_URL, options: SetupOptions = {}) {
	const values = new Map<string, string>();
	const sessionValues = new Map<string, string>();
	const location = { href: url };
	const storage = {
		setItem: vi.fn((key: string, value: string) => {
			values.set(key, value);
		}),
	};
	const history = {
		state: { key: "router-state" },
		replaceState: vi.fn(
			(state: unknown, _unused: string, nextUrl?: string | URL | null) => {
				history.state = state as { key: string };
				if (nextUrl) location.href = String(nextUrl);
			},
		),
	};
	const sessionStorage = {
		getItem: vi.fn((key: string) => sessionValues.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			sessionValues.set(key, value);
		}),
	};
	const fetch = vi.fn(async () => ({ ok: true, status: 204 }));
	const capture = createUtmCapture({
		apiBaseUrl: "https://api.wandit.example/base/path",
		fetch,
		history,
		location,
		now: () => CAPTURED_AT,
		referrer: options.referrer ?? "",
		sessionStorage,
		storage,
	});

	return {
		capture,
		fetch,
		history,
		location,
		sessionStorage,
		sessionValues,
		storage,
		values,
	};
}

describe("UTM capture", () => {
	it("parses the attribution fields and landing path", () => {
		const { capture } = setup();

		expect(capture()).toEqual({
			utmSource: "instagram",
			utmMedium: "story",
			utmCampaign: "summer-launch",
			utmContent: "hero",
			landingPath: "/pricing",
			at: "2026-08-15T10:30:00.000Z",
		});
	});

	it("posts UTM attribution once with the expected body", () => {
		const referrer = "https://instagram.example/stories/wandit";
		const { capture, fetch } = setup(ORIGINAL_URL, { referrer });

		expect(capture()).toEqual(
			expect.objectContaining({ utmSource: "instagram" }),
		);
		expect(capture()).toBeNull();

		expect(fetch).toHaveBeenCalledOnce();
		expect(fetch).toHaveBeenCalledWith(
			new URL("https://api.wandit.example/api/v1/attribution/utm"),
			{
				body: JSON.stringify({
					landingPath: "/pricing",
					utmSource: "instagram",
					utmMedium: "story",
					utmCampaign: "summer-launch",
					utmContent: "hero",
					referrer,
				}),
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				keepalive: true,
				method: "POST",
			},
		);
	});

	it("overwrites the last-touch stash with missing fields set to null", () => {
		const { capture, storage, values } = setup(
			"https://wandit.example/welcome?utm_source=newsletter&utm_term=founders",
		);
		values.set(UTM_LAST_TOUCH_STORAGE_KEY, "previous-touch");

		const result = capture();

		expect(storage.setItem).toHaveBeenCalledOnce();
		expect(storage.setItem).toHaveBeenCalledWith(
			UTM_LAST_TOUCH_STORAGE_KEY,
			JSON.stringify(result),
		);
		expect(JSON.parse(values.get(UTM_LAST_TOUCH_STORAGE_KEY) ?? "")).toEqual({
			utmSource: "newsletter",
			utmMedium: null,
			utmCampaign: null,
			utmContent: null,
			landingPath: "/welcome",
			at: "2026-08-15T10:30:00.000Z",
		});
	});

	it("strips only UTM parameters while preserving other parameters and the fragment", () => {
		const { capture, history, location } = setup(
			"https://wandit.example/pricing?ref=partner&utm_source=instagram&coupon=SAVE&utm_term=founders#plans",
		);

		capture();

		expect(history.replaceState).toHaveBeenCalledOnce();
		expect(history.replaceState).toHaveBeenCalledWith(
			{ key: "router-state" },
			"",
			"https://wandit.example/pricing?ref=partner&coupon=SAVE#plans",
		);
		expect(location.href).toBe(
			"https://wandit.example/pricing?ref=partner&coupon=SAVE#plans",
		);
	});

	it("posts external-referrer attribution once per tab session", () => {
		const referrer = "https://search.example/results?q=website+builder";
		const { capture, fetch, history, sessionStorage, sessionValues, storage } =
			setup("https://wandit.example/pricing?coupon=SAVE#plans", {
				referrer,
			});

		expect(capture()).toBeNull();
		expect(capture()).toBeNull();

		expect(fetch).toHaveBeenCalledOnce();
		expect(fetch).toHaveBeenCalledWith(
			new URL("https://api.wandit.example/api/v1/attribution/utm"),
			{
				body: JSON.stringify({ landingPath: "/pricing", referrer }),
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				keepalive: true,
				method: "POST",
			},
		);
		expect(sessionStorage.setItem).toHaveBeenCalledOnce();
		expect(sessionStorage.setItem).toHaveBeenCalledWith(
			REFERRER_ATTRIBUTION_SENT_STORAGE_KEY,
			"1",
		);
		expect(sessionValues.get(REFERRER_ATTRIBUTION_SENT_STORAGE_KEY)).toBe("1");
		expect(storage.setItem).not.toHaveBeenCalled();
		expect(history.replaceState).not.toHaveBeenCalled();
	});

	it("does not post referrer-only attribution for an internal referrer", () => {
		const { capture, fetch, sessionStorage } = setup(
			"https://wandit.example/pricing?coupon=SAVE#plans",
			{ referrer: "https://wandit.example/projects/123" },
		);

		expect(capture()).toBeNull();
		expect(fetch).not.toHaveBeenCalled();
		expect(sessionStorage.setItem).not.toHaveBeenCalled();
	});

	it("does not post referrer-only attribution without a referrer", () => {
		const { capture, fetch, history, location, storage, values } = setup(
			"https://wandit.example/pricing?ref=partner#plans",
		);
		values.set(UTM_LAST_TOUCH_STORAGE_KEY, "previous-touch");

		expect(capture()).toBeNull();
		expect(fetch).not.toHaveBeenCalled();
		expect(storage.setItem).not.toHaveBeenCalled();
		expect(history.replaceState).not.toHaveBeenCalled();
		expect(values.get(UTM_LAST_TOUCH_STORAGE_KEY)).toBe("previous-touch");
		expect(location.href).toBe(
			"https://wandit.example/pricing?ref=partner#plans",
		);
	});

	it("swallows a rejected attribution post without breaking stash or URL cleanup", async () => {
		const { capture, fetch, history, location, storage, values } = setup();
		fetch.mockRejectedValueOnce(new TypeError("network unavailable"));

		const result = capture();
		await Promise.resolve();
		expect(capture()).toBeNull();

		expect(result).toEqual(
			expect.objectContaining({
				landingPath: "/pricing",
				utmSource: "instagram",
			}),
		);
		expect(fetch).toHaveBeenCalledOnce();
		expect(storage.setItem).toHaveBeenCalledWith(
			UTM_LAST_TOUCH_STORAGE_KEY,
			JSON.stringify(result),
		);
		expect(values.get(UTM_LAST_TOUCH_STORAGE_KEY)).toBe(JSON.stringify(result));
		expect(history.replaceState).toHaveBeenCalledOnce();
		expect(location.href).toBe(
			"https://wandit.example/pricing?coupon=SAVE#plans",
		);
	});
});
