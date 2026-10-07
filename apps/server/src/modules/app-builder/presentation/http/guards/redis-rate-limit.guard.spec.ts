import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { ExecutionContext } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { MaybeAuthenticatedRequest } from "../../../../auth";
import {
	RateLimit,
	type RateLimitStore,
	RedisRateLimitGuard,
	RedisRateLimitStore,
} from "./redis-rate-limit.guard";

// The real-Redis case runs only with V2_REDIS_INTEGRATION_TEST=true and a
// Redis at REDIS_URL. CI has no Redis, so CI skips it.
const RUN_REDIS = process.env.V2_REDIS_INTEGRATION_TEST === "true";

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

	// A 1 s window, so the real-Redis case sees the window end.
	@RateLimit({
		key: "turn-stream-it",
		limit: 1,
		mode: "open",
		windowMs: 1_000,
	})
	shortStream() {}

	@RateLimit({
		ipLimit: 30,
		key: "project-create",
		limit: 10,
		windowMs: 86_400_000,
	})
	createProject() {}

	plain() {}
}

const PROJECT_CREATE_USER_KEY = "builder:rate:project-create:user-1";
const PROJECT_CREATE_IP_KEY = "builder:rate:project-create:ip:203.0.113.9";

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

function setup(count: number, ttlMs = 100_000, userId = "user-1") {
	const store: RateLimitStore = {
		hit: vi.fn(async () => ({ count, ttlMs })),
		release: vi.fn(async () => undefined),
	};
	const response = {
		header: vi.fn(),
		// SAFETY: the guard only calls `header` on the reply.
	} as unknown as FastifyReply;
	// One proxy hop: the trusted client IP of the request.
	const headers: FastifyRequest["headers"] = {
		"x-forwarded-for": "203.0.113.9",
	};
	// SAFETY: the guard reads `user.id`, `headers`, and `ip` only.
	const request = {
		headers,
		ip: "10.0.0.2",
		user: { id: userId },
	} as MaybeAuthenticatedRequest;

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
		);
		expect(store.release).toHaveBeenCalledWith(
			"builder:rate:turn-stream:user-1",
		);
		// Open slots cap the hint at 60 s so clients retry soon.
		expect(response.header).toHaveBeenCalledWith("Retry-After", "60");
	});

	it("lets the request through when the store throws", async () => {
		const { guard, request, response, store } = setup(1);
		vi.mocked(store.hit).mockRejectedValue(new Error("connect ECONNREFUSED"));

		await expect(
			guard.canActivate(
				contextFor(FakeController.prototype.create, request, response),
			),
		).resolves.toBe(true);
	});

	// Row 1 fails when a denied user still counts on the shared IP key.
	// Row 2 fails when the 429 sends the wait of the user key.
	it.each([
		{
			case: "the user key is over",
			countedKeys: [PROJECT_CREATE_USER_KEY],
			ipHit: { count: 1, ttlMs: 1_800_000 },
			retryAfter: "500",
			userHit: { count: 11, ttlMs: 500_000 },
		},
		{
			case: "only the IP key is over",
			countedKeys: [PROJECT_CREATE_USER_KEY, PROJECT_CREATE_IP_KEY],
			ipHit: { count: 31, ttlMs: 1_800_000 },
			retryAfter: "1800",
			userHit: { count: 1, ttlMs: 2_000_000 },
		},
	])("throws 429 with the wait of the denying key when $case", async ({
		countedKeys,
		ipHit,
		retryAfter,
		userHit,
	}) => {
		const { guard, request, response, store } = setup(0);
		vi.mocked(store.hit).mockImplementation(async (key) =>
			key === PROJECT_CREATE_IP_KEY ? ipHit : userHit,
		);

		await expect(
			guard.canActivate(
				contextFor(FakeController.prototype.createProject, request, response),
			),
		).rejects.toBeInstanceOf(HttpException);
		expect(vi.mocked(store.hit).mock.calls).toEqual(
			countedKeys.map((key) => [key, 86_400_000]),
		);
		expect(response.header).toHaveBeenCalledWith("Retry-After", retryAfter);
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

describe.skipIf(!RUN_REDIS)("RedisRateLimitGuard on a real Redis", () => {
	// Fails when an open hit resets the slot TTL. Then a slot that a killed
	// relay did not release blocks every reopen while the user retries.
	it("frees a leaked open slot when its window ends, while the user retries", async () => {
		const store = new RedisRateLimitStore();
		const guard = new RedisRateLimitGuard(new Reflector(), store);
		// A new user id per run, so an earlier run cannot fill the bucket.
		const { request, response } = setup(0, 0, `it-${randomUUID()}`);
		const open = () =>
			guard.canActivate(
				contextFor(FakeController.prototype.shortStream, request, response),
			);
		try {
			// The API dies with this stream open, so no release runs.
			await expect(open()).resolves.toBe(true);
			await delay(600);
			// The browser reopens inside the window; the leaked slot fills the cap.
			await expect(open()).rejects.toBeInstanceOf(HttpException);
			await delay(600);
			// 1.2 s after the first open, the 1 s window ended with the leak.
			await expect(open()).resolves.toBe(true);
		} finally {
			await store.onModuleDestroy();
		}
	});
});
