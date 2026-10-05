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

function setup(count: number, ttlMs = 100_000) {
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
		user: { id: "user-1" },
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
			countedKeys.map((key) => [key, 86_400_000, false]),
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
