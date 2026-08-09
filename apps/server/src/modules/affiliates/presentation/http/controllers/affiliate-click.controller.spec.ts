import {
	AFFILIATE_ATTRIBUTION_COOKIE_NAME,
	type AffiliateClickBody,
} from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	BETTER_AUTH_URL: "https://api.test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import type {
	AffiliateClickResult,
	AffiliateClickService,
} from "../../../application/services/affiliate-click.service";
import { AffiliateClickController } from "./affiliate-click.controller";

const BODY = {
	code: "partner_123",
	landingUrl: "https://app.test/pricing?ref=partner_123",
} satisfies AffiliateClickBody;
const RESULT = {
	attributionToken: "v1.payload.signature",
	expiresAt: "2026-08-02T13:00:00.000Z",
	maxAgeSeconds: 3_600,
} satisfies AffiliateClickResult;

function setup() {
	const service = {
		capture: vi.fn(async (): Promise<AffiliateClickResult> => RESULT),
	};
	const controller = new AffiliateClickController(
		service as unknown as AffiliateClickService,
	);
	const reply = { header: vi.fn() };

	return { controller, reply, service };
}

function request(headers: FastifyRequest["headers"], ip = "10.0.0.10") {
	return { headers, ip } as unknown as FastifyRequest;
}

describe("AffiliateClickController", () => {
	beforeEach(() => {
		mockEnv.BETTER_AUTH_URL = "https://api.test";
	});

	it("uses the first forwarded IP and writes the secure cross-site cookie", async () => {
		const { controller, reply, service } = setup();
		const req = request({
			"user-agent": "browser-test-agent",
			"x-forwarded-for": " 203.0.113.25, 198.51.100.8 ",
		});

		const response = await controller.click(
			BODY,
			req,
			reply as unknown as FastifyReply,
		);

		expect(service.capture).toHaveBeenCalledWith(BODY, {
			ip: "203.0.113.25",
			userAgent: "browser-test-agent",
		});
		expect(reply.header).toHaveBeenCalledWith(
			"set-cookie",
			`${AFFILIATE_ATTRIBUTION_COOKIE_NAME}=v1.payload.signature; Max-Age=3600; Path=/; HttpOnly; SameSite=None; Secure`,
		);
		expect(response).toEqual({
			attributionToken: RESULT.attributionToken,
			expiresAt: RESULT.expiresAt,
		});
	});

	it("uses SameSite=Lax without Secure for an HTTP auth origin", async () => {
		const { controller, reply } = setup();
		mockEnv.BETTER_AUTH_URL = "http://api.test";

		await controller.click(
			BODY,
			request({}, "127.0.0.1"),
			reply as unknown as FastifyReply,
		);

		expect(reply.header).toHaveBeenCalledWith(
			"set-cookie",
			`${AFFILIATE_ATTRIBUTION_COOKIE_NAME}=v1.payload.signature; Max-Age=3600; Path=/; HttpOnly; SameSite=Lax`,
		);
	});
});
