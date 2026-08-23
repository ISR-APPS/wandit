import { HttpStatus, Logger } from "@nestjs/common";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import {
	UTM_ATTRIBUTION_COOKIE_NAME,
	type UtmAttributionBody,
} from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	BETTER_AUTH_URL: "https://api.test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import { IS_PUBLIC_KEY } from "../../../../auth/presentation/http/decorators/public.decorator";
import type { UtmAttributionThrottle } from "../../../application/services/utm-attribution-throttle";
import type { UtmAttributionTokenService } from "../../../application/services/utm-attribution-token.service";
import {
	UTM_ATTRIBUTION_WINDOW_SECONDS,
	type UtmAttributionTokenPayload,
} from "../../../domain/utm-attribution-token";
import { UtmAttributionController } from "./utm-attribution.controller";

const NOW = new Date("2026-08-15T12:00:00.000Z");
const BODY = {
	landingPath: "/pricing",
	referrer: "https://www.google.com/search?q=wandit",
	utmCampaign: "summer-launch",
	utmMedium: "cpc",
	utmSource: "google",
} satisfies UtmAttributionBody;
const TOKEN = "v1.payload.signature";
const EXISTING_TOKEN = "v1.existing+payload/signature?";

function storyLinkPayload(
	overrides: Partial<UtmAttributionTokenPayload> = {},
): UtmAttributionTokenPayload {
	return {
		issuedAt: Math.floor(NOW.getTime() / 1_000) - 60,
		landingPath: "/pricing",
		storyLinkSlug: "summer-story",
		utmCampaign: BODY.utmCampaign,
		utmMedium: BODY.utmMedium,
		utmSource: BODY.utmSource,
		...overrides,
	};
}

function attributionCookie(token = EXISTING_TOKEN): string {
	return `${UTM_ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

function setup() {
	const throttle = {
		allow: vi.fn(() => true),
	};
	const tokenService = {
		sign: vi.fn(() => TOKEN),
		verify: vi.fn(
			(_token: string, _now?: Date): UtmAttributionTokenPayload | null => null,
		),
	};
	const controller = new UtmAttributionController(
		throttle as unknown as UtmAttributionThrottle,
		tokenService as unknown as UtmAttributionTokenService,
	);
	const reply = { header: vi.fn() };

	return { controller, reply, throttle, tokenService };
}

function request(
	headers: FastifyRequest["headers"],
	ip = "198.51.100.10",
): FastifyRequest {
	return { headers, ip } as unknown as FastifyRequest;
}

describe("UtmAttributionController", () => {
	beforeEach(() => {
		mockEnv.BETTER_AUTH_URL = "https://api.test";
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("is public and responds with no content", () => {
		expect(Reflect.getMetadata(IS_PUBLIC_KEY, UtmAttributionController)).toBe(
			true,
		);
		expect(
			Reflect.getMetadata(
				HTTP_CODE_METADATA,
				UtmAttributionController.prototype.capture,
			),
		).toBe(HttpStatus.NO_CONTENT);
	});

	it("uses the first forwarded IP and writes the secure cross-site cookie", () => {
		const { controller, reply, throttle, tokenService } = setup();

		controller.capture(
			BODY,
			request({
				"x-forwarded-for": " 203.0.113.25, 198.51.100.8 ",
			}),
			reply as unknown as FastifyReply,
		);

		expect(throttle.allow).toHaveBeenCalledWith("203.0.113.25");
		expect(tokenService.sign).toHaveBeenCalledWith({
			...BODY,
			issuedAt: Math.floor(NOW.getTime() / 1_000),
		});
		expect(reply.header).toHaveBeenCalledWith(
			"set-cookie",
			`${UTM_ATTRIBUTION_COOKIE_NAME}=${TOKEN}; Max-Age=${UTM_ATTRIBUTION_WINDOW_SECONDS}; Path=/; HttpOnly; SameSite=None; Secure`,
		);
	});

	it("preserves a verified story-link slug when all UTM values match", () => {
		const { controller, reply, tokenService } = setup();
		tokenService.verify.mockReturnValueOnce(storyLinkPayload());

		controller.capture(
			BODY,
			request({
				cookie: `session=other; ${attributionCookie()}; preference=compact`,
			}),
			reply as unknown as FastifyReply,
		);

		expect(tokenService.verify).toHaveBeenCalledWith(EXISTING_TOKEN);
		expect(tokenService.sign).toHaveBeenCalledWith({
			...BODY,
			issuedAt: Math.floor(NOW.getTime() / 1_000),
			storyLinkSlug: "summer-story",
		});
	});

	it.each([
		["source", { utmSource: "newsletter" }],
		["medium", { utmMedium: "email" }],
		["campaign", { utmCampaign: "autumn-launch" }],
	] as const)("drops the story-link slug when the UTM %s differs", (_, change) => {
		const { controller, reply, tokenService } = setup();
		tokenService.verify.mockReturnValueOnce(storyLinkPayload());
		const body = { ...BODY, ...change };

		controller.capture(
			body,
			request({ cookie: attributionCookie() }),
			reply as unknown as FastifyReply,
		);

		expect(tokenService.sign).toHaveBeenCalledWith({
			...body,
			issuedAt: Math.floor(NOW.getTime() / 1_000),
		});
	});

	it.each([
		[
			"the existing content is absent and the incoming content has a value",
			storyLinkPayload(),
			{ ...BODY, utmContent: "hero-cta" },
		],
		[
			"the existing content has a value and the incoming content is absent",
			storyLinkPayload({ utmContent: "hero-cta" }),
			BODY,
		],
	] satisfies ReadonlyArray<
		readonly [string, UtmAttributionTokenPayload, UtmAttributionBody]
	>)("drops the story-link slug when %s", (_, existingPayload, body) => {
		const { controller, reply, tokenService } = setup();
		tokenService.verify.mockReturnValueOnce(existingPayload);

		controller.capture(
			body,
			request({ cookie: attributionCookie() }),
			reply as unknown as FastifyReply,
		);

		expect(tokenService.sign).toHaveBeenCalledWith({
			...body,
			issuedAt: Math.floor(NOW.getTime() / 1_000),
		});
	});

	it("ignores an invalid existing attribution cookie", () => {
		const { controller, reply, tokenService } = setup();
		tokenService.verify.mockReturnValueOnce(null);

		controller.capture(
			BODY,
			request({ cookie: attributionCookie("invalid-token") }),
			reply as unknown as FastifyReply,
		);

		expect(tokenService.verify).toHaveBeenCalledWith("invalid-token");
		expect(tokenService.sign).toHaveBeenCalledWith({
			...BODY,
			issuedAt: Math.floor(NOW.getTime() / 1_000),
		});
	});

	it("ignores an absent existing attribution cookie", () => {
		const { controller, reply, tokenService } = setup();

		controller.capture(
			BODY,
			request({ cookie: "session=other" }),
			reply as unknown as FastifyReply,
		);

		expect(tokenService.verify).not.toHaveBeenCalled();
		expect(tokenService.sign).toHaveBeenCalledWith({
			...BODY,
			issuedAt: Math.floor(NOW.getTime() / 1_000),
		});
	});

	it("uses SameSite=Lax without Secure for an HTTP auth origin", () => {
		const { controller, reply, throttle } = setup();
		mockEnv.BETTER_AUTH_URL = "http://api.test";

		controller.capture(
			BODY,
			request({}, "127.0.0.1"),
			reply as unknown as FastifyReply,
		);

		expect(throttle.allow).toHaveBeenCalledWith("127.0.0.1");
		expect(reply.header).toHaveBeenCalledWith(
			"set-cookie",
			`${UTM_ATTRIBUTION_COOKIE_NAME}=${TOKEN}; Max-Age=${UTM_ATTRIBUTION_WINDOW_SECONDS}; Path=/; HttpOnly; SameSite=Lax`,
		);
	});

	it("silently drops a throttled capture without signing or setting a cookie", () => {
		const { controller, reply, throttle, tokenService } = setup();
		throttle.allow.mockReturnValueOnce(false);

		expect(() =>
			controller.capture(
				BODY,
				request({}, "198.51.100.10"),
				reply as unknown as FastifyReply,
			),
		).not.toThrow();

		expect(tokenService.sign).not.toHaveBeenCalled();
		expect(reply.header).not.toHaveBeenCalled();
	});

	it.each([
		"token signing",
		"cookie writing",
	])("swallows internal %s failures", (failurePoint) => {
		const { controller, reply, tokenService } = setup();
		const error = new Error(`${failurePoint} failed`);
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);

		if (failurePoint === "token signing") {
			tokenService.sign.mockImplementationOnce(() => {
				throw error;
			});
		} else {
			reply.header.mockImplementationOnce(() => {
				throw error;
			});
		}

		expect(() =>
			controller.capture(
				BODY,
				request({}, "198.51.100.10"),
				reply as unknown as FastifyReply,
			),
		).not.toThrow();
		expect(warn).toHaveBeenCalledWith(
			"Failed to capture UTM attribution",
			error,
		);
	});
});
