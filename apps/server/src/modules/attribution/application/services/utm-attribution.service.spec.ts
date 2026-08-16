import { Logger } from "@nestjs/common";
import { UTM_ATTRIBUTION_COOKIE_NAME } from "@wandit/contracts";
import type { GenericEndpointContext } from "better-auth";
import { describe, expect, it, vi } from "vitest";

import type { UtmAttributionTokenPayload } from "../../domain/utm-attribution-token";
import type {
	UserAttributionRepository,
	UserAttributionRow,
} from "../../infrastructure/persistence/user-attribution.repository";
import { UtmAttributionService } from "./utm-attribution.service";
import type { UtmAttributionTokenService } from "./utm-attribution-token.service";

const NOW = new Date("2026-08-15T12:00:00.000Z");
const USER = { id: "user_1" };
const PAYLOAD: UtmAttributionTokenPayload = {
	issuedAt: Math.floor(NOW.getTime() / 1_000),
	landingPath: "/pricing?plan=pro",
	referrer: "https://www.google.com/search?q=wandit",
	storyLinkSlug: "summer-story",
	utmCampaign: "summer-launch",
	utmContent: "hero-cta",
	utmMedium: "cpc",
	utmSource: "google",
};

function attributionRow(
	overrides: Partial<UserAttributionRow> = {},
): UserAttributionRow {
	return {
		country: "US",
		createdAt: NOW,
		device: "desktop",
		id: "attribution_1",
		landingPath: PAYLOAD.landingPath ?? null,
		referrer: PAYLOAD.referrer ?? null,
		source: "cookie",
		storyLinkSlug: PAYLOAD.storyLinkSlug ?? null,
		updatedAt: NOW,
		userId: USER.id,
		utmCampaign: PAYLOAD.utmCampaign ?? null,
		utmContent: PAYLOAD.utmContent ?? null,
		utmMedium: PAYLOAD.utmMedium ?? null,
		utmSource: PAYLOAD.utmSource ?? null,
		...overrides,
	};
}

function signupContext(input: {
	body?: unknown;
	cookieToken?: string;
	headers?: Headers | Record<string, string>;
}) {
	const getCookie = vi.fn((name: string) =>
		name === UTM_ATTRIBUTION_COOKIE_NAME ? input.cookieToken : undefined,
	);

	return {
		ctx: {
			body: input.body ?? {},
			getCookie,
			headers:
				input.headers instanceof Headers
					? input.headers
					: new Headers(input.headers),
		} as unknown as GenericEndpointContext,
		getCookie,
	};
}

function setup() {
	const row = attributionRow();
	const repository = {
		insertFirstWins: vi.fn(async (): Promise<UserAttributionRow | null> => row),
	};
	const tokenService = {
		verify: vi.fn(
			(_token: string, _now: Date): UtmAttributionTokenPayload | null =>
				PAYLOAD,
		),
	};
	const service = new UtmAttributionService(
		repository as unknown as UserAttributionRepository,
		tokenService as unknown as UtmAttributionTokenService,
	);

	return { repository, row, service, tokenService };
}

describe("UtmAttributionService", () => {
	it("uses only the cookie token and persists every signed field with request context", async () => {
		const { repository, row, service, tokenService } = setup();
		const { ctx, getCookie } = signupContext({
			body: { utmAttributionToken: "ignored-body-token" },
			cookieToken: "cookie-token",
			headers: new Headers({
				"cf-ipcountry": "CA",
				"user-agent":
					"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1",
				"x-vercel-ip-country": "us",
			}),
		});

		await expect(service.lockForCreatedUser(USER, ctx, NOW)).resolves.toBe(row);

		expect(getCookie).toHaveBeenCalledWith(UTM_ATTRIBUTION_COOKIE_NAME);
		expect(tokenService.verify).toHaveBeenCalledOnce();
		expect(tokenService.verify).toHaveBeenCalledWith("cookie-token", NOW);
		expect(repository.insertFirstWins).toHaveBeenCalledWith({
			country: "US",
			device: "mobile",
			landingPath: PAYLOAD.landingPath,
			referrer: PAYLOAD.referrer,
			source: "cookie",
			storyLinkSlug: PAYLOAD.storyLinkSlug,
			userId: USER.id,
			utmCampaign: PAYLOAD.utmCampaign,
			utmContent: PAYLOAD.utmContent,
			utmMedium: PAYLOAD.utmMedium,
			utmSource: PAYLOAD.utmSource,
		});
	});

	it("ignores a body token when the attribution cookie is missing", async () => {
		const { repository, service, tokenService } = setup();
		const { ctx } = signupContext({
			body: { utmAttributionToken: "body-token" },
		});

		await expect(
			service.lockForCreatedUser(USER, ctx, NOW),
		).resolves.toBeNull();

		expect(tokenService.verify).not.toHaveBeenCalled();
		expect(repository.insertFirstWins).not.toHaveBeenCalled();
	});

	it("does nothing when the Better Auth hook has no request context", async () => {
		const { repository, service, tokenService } = setup();

		await expect(
			service.lockForCreatedUser(USER, null, NOW),
		).resolves.toBeNull();

		expect(tokenService.verify).not.toHaveBeenCalled();
		expect(repository.insertFirstWins).not.toHaveBeenCalled();
	});

	it.each([
		"tampered-token",
		"expired-token",
	])("rejects an invalid or expired cookie token (%s)", async (cookieToken) => {
		const { repository, service, tokenService } = setup();
		const { ctx } = signupContext({ cookieToken });
		tokenService.verify.mockReturnValueOnce(null);

		await expect(
			service.lockForCreatedUser(USER, ctx, NOW),
		).resolves.toBeNull();

		expect(tokenService.verify).toHaveBeenCalledWith(cookieToken, NOW);
		expect(repository.insertFirstWins).not.toHaveBeenCalled();
	});

	it.each([
		{
			device: "tablet",
			name: "an Android tablet",
			userAgent: "Mozilla/5.0 (Linux; Android 13; SM-X700) Safari/537.36",
		},
		{
			device: "desktop",
			name: "a desktop browser",
			userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/128.0",
		},
		{ device: null, name: "a missing user-agent", userAgent: undefined },
	] as const)("stores $device for $name", async ({ device, userAgent }) => {
		const { repository, service } = setup();
		const { ctx } = signupContext({
			cookieToken: "valid-token",
			headers: userAgent ? { "user-agent": userAgent } : undefined,
		});

		await service.lockForCreatedUser(USER, ctx, NOW);

		expect(repository.insertFirstWins).toHaveBeenCalledWith(
			expect.objectContaining({ device }),
		);
	});

	it("returns null when the first-wins insert reports a duplicate user", async () => {
		const { repository, service } = setup();
		const { ctx } = signupContext({ cookieToken: "valid-token" });
		repository.insertFirstWins.mockResolvedValueOnce(null);

		await expect(
			service.lockForCreatedUser(USER, ctx, NOW),
		).resolves.toBeNull();

		expect(repository.insertFirstWins).toHaveBeenCalledOnce();
	});

	it.each([
		{ country: "DZ", headers: { "cf-ipcountry": "dz" }, name: "Cloudflare" },
		{ country: null, headers: { "cf-ipcountry": "XX" }, name: "XX sentinel" },
		{ country: null, headers: { "cf-ipcountry": "T1" }, name: "T1 sentinel" },
	])("stores $country for $name country headers", async ({
		country,
		headers,
	}) => {
		const { repository, service } = setup();
		const { ctx } = signupContext({
			cookieToken: "valid-token",
			headers,
		});

		await service.lockForCreatedUser(USER, ctx, NOW);

		expect(repository.insertFirstWins).toHaveBeenCalledWith(
			expect.objectContaining({ country }),
		);
	});

	it("swallows repository failures so signup can continue", async () => {
		const { repository, service } = setup();
		const { ctx } = signupContext({ cookieToken: "valid-token" });
		const error = new Error("database unavailable");
		repository.insertFirstWins.mockRejectedValueOnce(error);
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);

		await expect(
			service.lockForCreatedUser(USER, ctx, NOW),
		).resolves.toBeNull();
		expect(warn).toHaveBeenCalledWith(
			`Failed to lock UTM attribution for user ${USER.id}`,
			error,
		);

		warn.mockRestore();
	});
});
