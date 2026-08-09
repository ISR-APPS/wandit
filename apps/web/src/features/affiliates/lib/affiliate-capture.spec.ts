import { describe, expect, it, vi } from "vitest";

import {
	AFFILIATE_TOKEN_STORAGE_KEY,
	createAffiliateCapture,
	withAffiliateEmailSignupToken,
	withAffiliateTokenForAuthRequest,
} from "./affiliate-capture";

const ORIGINAL_URL =
	"https://wandit.example/?utm_source=partner&ref=partner_123#pricing";

function setup(url = ORIGINAL_URL) {
	const values = new Map<string, string>();
	const location = { href: url };
	const storage = {
		getItem: vi.fn((key: string) => values.get(key) ?? null),
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
	const fetch = vi.fn(async () => ({
		json: async () => ({
			data: {
				attributionToken: "v1.payload.hmac",
				expiresAt: "2026-09-01T00:00:00.000Z",
			},
		}),
		ok: true,
		status: 200,
	}));
	const capture = createAffiliateCapture({
		apiBaseUrl: "https://api.wandit.example/base/path",
		fetch,
		history,
		location,
		storage,
	});

	return { capture, fetch, history, location, storage, values };
}

describe("affiliate capture", () => {
	it("posts the referral, stores the signed token, and strips only ref", async () => {
		const { capture, fetch, history, location, storage } = setup();

		await expect(capture()).resolves.toEqual({
			attributionToken: "v1.payload.hmac",
			code: "partner_123",
			expiresAt: "2026-09-01T00:00:00.000Z",
		});

		expect(fetch).toHaveBeenCalledOnce();
		expect(fetch).toHaveBeenCalledWith(
			new URL("https://api.wandit.example/api/v1/affiliates/click"),
			{
				body: JSON.stringify({
					code: "partner_123",
					landingUrl: ORIGINAL_URL,
				}),
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				keepalive: true,
				method: "POST",
			},
		);
		expect(storage.setItem).toHaveBeenCalledWith(
			AFFILIATE_TOKEN_STORAGE_KEY,
			"v1.payload.hmac",
		);
		expect(history.replaceState).toHaveBeenCalledOnce();
		expect(location.href).toBe(
			"https://wandit.example/?utm_source=partner#pricing",
		);
	});

	it("does not fire twice when route capture runs again", async () => {
		const { capture, fetch } = setup();

		const first = capture();
		const second = capture();

		await expect(Promise.all([first, second])).resolves.toEqual([
			expect.objectContaining({ attributionToken: "v1.payload.hmac" }),
			null,
		]);
		expect(fetch).toHaveBeenCalledOnce();
	});

	it("keeps the referral available for retry after a transient failure", async () => {
		const { capture, fetch, history, location } = setup();
		fetch
			.mockRejectedValueOnce(new TypeError("network unavailable"))
			.mockResolvedValueOnce({
				json: async () => ({
					data: {
						attributionToken: "v1.payload.hmac",
						expiresAt: "2026-09-01T00:00:00.000Z",
					},
				}),
				ok: true,
				status: 200,
			});

		await expect(capture()).rejects.toThrow("network unavailable");
		expect(location.href).toBe(ORIGINAL_URL);
		expect(history.replaceState).not.toHaveBeenCalled();

		await expect(capture()).resolves.toEqual(
			expect.objectContaining({ attributionToken: "v1.payload.hmac" }),
		);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(location.href).toBe(
			"https://wandit.example/?utm_source=partner#pricing",
		);
	});

	it("ignores a URL without a referral parameter", async () => {
		const { capture, fetch, history } = setup(
			"https://wandit.example/?utm_source=partner#pricing",
		);

		await expect(capture()).resolves.toBeNull();
		expect(fetch).not.toHaveBeenCalled();
		expect(history.replaceState).not.toHaveBeenCalled();
	});

	it("adds the stored token to a Better Auth email-signup body", () => {
		const { storage, values } = setup();
		values.set(AFFILIATE_TOKEN_STORAGE_KEY, "v1.payload.hmac");

		expect(
			withAffiliateEmailSignupToken(
				{
					email: "seller@example.com",
					name: "Nadia Benali",
					password: "correct-horse-battery-staple",
				},
				storage,
			),
		).toEqual({
			affiliateToken: "v1.payload.hmac",
			email: "seller@example.com",
			name: "Nadia Benali",
			password: "correct-horse-battery-staple",
		});
	});

	it("injects the localStorage token into the actual Better Auth email-signup request path", () => {
		const { storage, values } = setup();
		values.set(AFFILIATE_TOKEN_STORAGE_KEY, "v1.request.payload.hmac");
		const serializedBody = JSON.stringify({
			email: "seller@example.com",
			name: "Nadia Benali",
			password: "correct-horse-battery-staple",
		});

		const requestBody = withAffiliateTokenForAuthRequest(
			"https://api.wandit.example/api/auth/sign-up/email",
			serializedBody,
			storage,
		);

		expect(typeof requestBody).toBe("string");
		expect(JSON.parse(requestBody as string)).toEqual({
			affiliateToken: "v1.request.payload.hmac",
			email: "seller@example.com",
			name: "Nadia Benali",
			password: "correct-horse-battery-staple",
		});
	});

	it("does not leak the affiliate token into non-signup auth requests", () => {
		const { storage, values } = setup();
		values.set(AFFILIATE_TOKEN_STORAGE_KEY, "v1.request.payload.hmac");
		const body = { email: "seller@example.com" };

		expect(
			withAffiliateTokenForAuthRequest(
				"https://api.wandit.example/api/auth/sign-in/email",
				body,
				storage,
			),
		).toBe(body);
	});
});
