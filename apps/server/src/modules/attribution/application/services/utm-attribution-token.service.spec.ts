import { describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	BETTER_AUTH_SECRET:
		"utm-attribution-test-secret-that-is-at-least-32-characters",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import {
	UTM_ATTRIBUTION_WINDOW_SECONDS,
	type UtmAttributionTokenPayload,
} from "../../domain/utm-attribution-token";
import { UtmAttributionTokenService } from "./utm-attribution-token.service";

const NOW = new Date("2026-08-15T12:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW.getTime() / 1_000);

function payload(
	overrides: Partial<UtmAttributionTokenPayload> = {},
): UtmAttributionTokenPayload {
	return {
		issuedAt: NOW_SECONDS,
		landingPath: "/pricing?plan=pro",
		referrer: "https://search.example/results?q=wandit",
		storyLinkSlug: "summer-story",
		utmCampaign: "summer-launch",
		utmContent: "hero-cta",
		utmMedium: "paid-social",
		utmSource: "instagram",
		...overrides,
	};
}

describe("UtmAttributionTokenService", () => {
	it("round-trips the exact signed attribution payload", () => {
		const service = new UtmAttributionTokenService();
		const input = payload();

		const token = service.sign(input);

		expect(token.split(".")).toHaveLength(3);
		expect(service.verify(token, NOW)).toEqual(input);
	});

	it("rejects payload and signature tampering", () => {
		const service = new UtmAttributionTokenService();
		const token = service.sign(payload());
		const [version, encodedPayload, signature] = token.split(".") as [
			string,
			string,
			string,
		];
		const decoded = JSON.parse(
			Buffer.from(encodedPayload, "base64url").toString("utf8"),
		) as UtmAttributionTokenPayload;
		const changedPayload = Buffer.from(
			JSON.stringify({ ...decoded, utmSource: "invented-source" }),
		).toString("base64url");
		const changedSignature = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;

		expect(
			service.verify(`${version}.${changedPayload}.${signature}`, NOW),
		).toBeNull();
		expect(
			service.verify(`${version}.${encodedPayload}.${changedSignature}`, NOW),
		).toBeNull();
	});

	it("rejects a token issued in the future", () => {
		const service = new UtmAttributionTokenService();
		const token = service.sign(payload({ issuedAt: NOW_SECONDS + 1 }));

		expect(service.verify(token, NOW)).toBeNull();
	});

	it("rejects a token at the exact attribution-window expiry boundary", () => {
		const service = new UtmAttributionTokenService();
		const expired = service.sign(
			payload({ issuedAt: NOW_SECONDS - UTM_ATTRIBUTION_WINDOW_SECONDS }),
		);
		const stillValid = service.sign(
			payload({
				issuedAt: NOW_SECONDS - UTM_ATTRIBUTION_WINDOW_SECONDS + 1,
			}),
		);

		expect(service.verify(expired, NOW)).toBeNull();
		expect(service.verify(stillValid, NOW)).toEqual(
			expect.objectContaining({
				issuedAt: NOW_SECONDS - UTM_ATTRIBUTION_WINDOW_SECONDS + 1,
			}),
		);
	});
});
