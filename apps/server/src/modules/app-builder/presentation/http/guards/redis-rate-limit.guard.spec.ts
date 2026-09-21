import type { ExecutionContext } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyReply } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { MaybeAuthenticatedRequest } from "../../../../auth";
import {
	RateLimit,
	type RateLimitStore,
	RedisRateLimitGuard,
	rateLimitRedis,
} from "./redis-rate-limit.guard";

class FakeController {
	@RateLimit({ key: "turn-create", limit: 2, windowMs: 600_000 })
	create() {}

	@RateLimit({
		key: "turn-stream",
		limit: 1,
		mode: "open",
		windowMs: 3_600_000,
	})
	stream() {}

	plain() {}
}

function contextFor(
	handler: (...args: never[]) => unknown,
	request: MaybeAuthenticatedRequest,
	response: FastifyReply,
): ExecutionContext {
	// SAFETY: the guard reads getHandler/getClass and the HTTP pair only.
	return {
		getClass: () => FakeController,
		getHandler: () => handler,
		switchToHttp: () => ({
			getRequest: () => request,
			getResponse: () => response,
		}),
	} as unknown as ExecutionContext;
}

function setup(count: number, ttlMs = 100_000) {
	const store: RateLimitStore = {
		hit: vi.fn(async () => ({ count, ttlMs })),
		release: vi.fn(async () => undefined),
	};
	const response = {
		header: vi.fn(),
		// SAFETY: the guard only calls `header` on the reply.
	} as unknown as FastifyReply;
	const request = {
		user: { id: "user-1" },
		// SAFETY: the guard reads `user.id` only.
	} as unknown as MaybeAuthenticatedRequest;

	return {
		guard: new RedisRateLimitGuard(new Reflector(), store),
		request,
		response,
		store,
	};
}

describe("RedisRateLimitGuard", () => {
	it("lets a request under the limit through", async () => {
		const { guard, request, response, store } = setup(1);

		await expect(
			guard.canActivate(
				contextFor(FakeController.prototype.create, request, response),
			),
		).resolves.toBe(true);
		expect(store.hit).toHaveBeenCalledWith(
			"builder:rate:turn-create:user-1",
			600_000,
			false,
		);
	});

	it("throws 429 with Retry-After when the window is full", async () => {
		const { guard, request, response } = setup(3, 300_000);

		const error = await guard
			.canActivate(
				contextFor(FakeController.prototype.create, request, response),
			)
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(HttpException);
		// SAFETY: instanceof guard above proves the cast.
		expect((error as HttpException).getStatus()).toBe(429);
		expect(response.header).toHaveBeenCalledWith("Retry-After", "300");
	});

	it("releases the slot a denied open-mode request took", async () => {
		const { guard, request, response, store } = setup(2);

		await expect(
			guard.canActivate(
				contextFor(FakeController.prototype.stream, request, response),
			),
		).rejects.toBeInstanceOf(HttpException);
		expect(store.hit).toHaveBeenCalledWith(
			"builder:rate:turn-stream:user-1",
			3_600_000,
			true,
		);
		expect(store.release).toHaveBeenCalledWith(
			"builder:rate:turn-stream:user-1",
		);
		// Open slots cap the hint at 60 s so clients retry soon.
		expect(response.header).toHaveBeenCalledWith("Retry-After", "60");
	});

	it("skips handlers without RateLimit metadata", async () => {
		const { guard, request, response, store } = setup(99);

		await expect(
			guard.canActivate(
				contextFor(FakeController.prototype.plain, request, response),
			),
		).resolves.toBe(true);
		expect(store.hit).not.toHaveBeenCalled();
	});
});

describe("rate-limit Lua scripts", () => {
	it("hit script bumps the counter and re-arms TTL for open slots", () => {
		expect(rateLimitRedis.hitScript).toBe(`
local count = redis.call("INCR", KEYS[1])
if count == 1 or ARGV[2] == "open" then
	redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return {count, redis.call("PTTL", KEYS[1])}
`);
	});

	it("release script floors the counter at zero", () => {
		expect(rateLimitRedis.releaseScript).toBe(`
local count = redis.call("DECR", KEYS[1])
if count < 0 then
	redis.call("DEL", KEYS[1])
	return 0
end
return count
`);
	});
});
