import { UTM_ATTRIBUTION_COOKIE_NAME } from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	BETTER_AUTH_URL: "https://api.test",
	CORS_ORIGIN: "https://web.test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import { IS_PUBLIC_KEY } from "../../../../auth/presentation/http/decorators/public.decorator";
import type {
	StoryLinkRedirectResult,
	StoryLinkRedirectService,
} from "../../../application/services/story-link-redirect.service";
import { StoryLinkRedirectController } from "./story-link-redirect.controller";

function setup() {
	const service = {
		resolve: vi.fn(
			async (): Promise<StoryLinkRedirectResult> => ({
				attributionToken: "v1.payload+/signature?",
				destination: "https://web.test/pricing",
			}),
		),
	};
	const controller = new StoryLinkRedirectController(
		service as unknown as StoryLinkRedirectService,
	);
	const reply = {
		header: vi.fn(),
		redirect: vi.fn(),
	};

	return { controller, reply, service };
}

function request(
	headers: FastifyRequest["headers"],
	ip = "198.51.100.10",
): FastifyRequest {
	return { headers, ip } as unknown as FastifyRequest;
}

describe("StoryLinkRedirectController", () => {
	beforeEach(() => {
		mockEnv.BETTER_AUTH_URL = "https://api.test";
	});

	it("is public and redirects with no-store using the first forwarded IP", async () => {
		const { controller, reply, service } = setup();

		await controller.redirect(
			"Summer-Story",
			request({
				"user-agent": "browser-test-agent",
				"x-forwarded-for": " 203.0.113.25, 198.51.100.8 ",
			}),
			reply as unknown as FastifyReply,
		);

		expect(
			Reflect.getMetadata(IS_PUBLIC_KEY, StoryLinkRedirectController),
		).toBe(true);
		expect(service.resolve).toHaveBeenCalledWith("Summer-Story", {
			ip: "203.0.113.25",
			userAgent: "browser-test-agent",
		});
		expect(reply.header).toHaveBeenCalledWith("Cache-Control", "no-store");
		expect(reply.header).toHaveBeenCalledWith(
			"set-cookie",
			`${UTM_ATTRIBUTION_COOKIE_NAME}=v1.payload%2B%2Fsignature%3F; Max-Age=2592000; Path=/; HttpOnly; SameSite=None; Secure`,
		);
		expect(reply.redirect).toHaveBeenCalledWith(
			"https://web.test/pricing",
			302,
		);
	});

	it("sets a lax UTM attribution cookie for an HTTP auth origin", async () => {
		const { controller, reply } = setup();
		mockEnv.BETTER_AUTH_URL = "http://api.test";

		await controller.redirect(
			"summer-story",
			request({}),
			reply as unknown as FastifyReply,
		);

		expect(reply.header).toHaveBeenCalledWith(
			"set-cookie",
			`${UTM_ATTRIBUTION_COOKIE_NAME}=v1.payload%2B%2Fsignature%3F; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`,
		);
		expect(reply.redirect).toHaveBeenCalledWith(
			"https://web.test/pricing",
			302,
		);
	});

	it("still redirects when writing the attribution cookie fails", async () => {
		const { controller, reply } = setup();
		reply.header.mockImplementation((name: string) => {
			if (name === "set-cookie") {
				throw new Error("headers already sent");
			}
		});

		await controller.redirect(
			"summer-story",
			request({}),
			reply as unknown as FastifyReply,
		);

		expect(reply.header).toHaveBeenCalledWith("Cache-Control", "no-store");
		expect(reply.redirect).toHaveBeenCalledWith(
			"https://web.test/pricing",
			302,
		);
	});

	it("falls back to the web root without a cookie when resolution throws", async () => {
		const { controller, reply, service } = setup();
		service.resolve.mockRejectedValueOnce(new Error("unexpected failure"));

		await controller.redirect(
			"summer-story",
			request({}),
			reply as unknown as FastifyReply,
		);

		expect(reply.header).toHaveBeenCalledWith("Cache-Control", "no-store");
		expect(reply.header).not.toHaveBeenCalledWith(
			"set-cookie",
			expect.anything(),
		);
		expect(reply.redirect).toHaveBeenCalledWith("https://web.test/", 302);
	});

	it("does not set a cookie for a resolved fallback", async () => {
		const { controller, reply, service } = setup();
		service.resolve.mockResolvedValueOnce({
			attributionToken: null,
			destination: "https://web.test/",
		});

		await controller.redirect(
			"missing-story",
			request({}),
			reply as unknown as FastifyReply,
		);

		expect(reply.header).not.toHaveBeenCalledWith(
			"set-cookie",
			expect.anything(),
		);
		expect(reply.redirect).toHaveBeenCalledWith("https://web.test/", 302);
	});
});
