import { PATH_METADATA } from "@nestjs/common/constants";
import type { AdminAuth } from "@wandit/auth";
import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AdminAuthController } from "./admin-auth.controller";

function responseWithCookies(): Response {
	const headers = new Headers({ "content-type": "application/json" });
	Object.defineProperty(headers, "getSetCookie", {
		value: () => [
			"first-cookie=token; Path=/; HttpOnly",
			"second-cookie=data; Path=/; HttpOnly",
		],
	});

	return {
		body: {},
		headers,
		status: 200,
		text: vi.fn(async () => '{"ok":true}'),
	} as unknown as Response;
}

describe("AdminAuthController", () => {
	it("mounts the public admin Better Auth surface", () => {
		expect(Reflect.getMetadata(PATH_METADATA, AdminAuthController)).toBe(
			"admin-auth",
		);
		expect(Reflect.getMetadata(IS_PUBLIC_KEY, AdminAuthController)).toBe(true);
	});

	it("forwards requests and preserves each Set-Cookie header", async () => {
		const handler = vi.fn(async (_request: Request) => responseWithCookies());
		const controller = new AdminAuthController({
			handler,
		} as unknown as AdminAuth);
		const request = {
			body: undefined,
			headers: { host: "localhost:3000" },
			method: "GET",
			url: "/api/admin-auth/get-session",
		} as FastifyRequest;
		const reply = {
			header: vi.fn(),
			send: vi.fn(),
			status: vi.fn(),
		} as unknown as FastifyReply;

		await controller.handleAuthPath(request, reply);

		expect(handler).toHaveBeenCalledOnce();
		expect((handler.mock.calls[0]?.[0] as Request).url).toBe(
			"http://localhost:3000/api/admin-auth/get-session",
		);
		expect(reply.header).toHaveBeenCalledWith(
			"set-cookie",
			"first-cookie=token; Path=/; HttpOnly",
		);
		expect(reply.header).toHaveBeenCalledWith(
			"set-cookie",
			"second-cookie=data; Path=/; HttpOnly",
		);
		expect(reply.send).toHaveBeenCalledWith('{"ok":true}');
	});
});
