import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DomainRateLimitExceededError } from "../../../domain/errors/domain.errors";
import { DomainRateLimitGuard } from "./rate-limit.guard";

function contextFor(userId: string): ExecutionContext {
	class TestController {}

	function testHandler() {}

	return {
		getClass: () => TestController,
		getHandler: () => testHandler,
		switchToHttp: () => ({
			getRequest: () => ({
				user: { id: userId },
			}),
		}),
	} as unknown as ExecutionContext;
}

describe("DomainRateLimitGuard", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("allows requests under the limit, rejects over the limit, and slides the window", () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);

		const guard = new DomainRateLimitGuard({
			getAllAndOverride: () => ({ limit: 2, windowMs: 1_000 }),
		} as unknown as Reflector);
		const context = contextFor("user_1");

		expect(guard.canActivate(context)).toBe(true);
		vi.setSystemTime(600);
		expect(guard.canActivate(context)).toBe(true);
		vi.setSystemTime(900);
		expect(() => guard.canActivate(context)).toThrow(
			DomainRateLimitExceededError,
		);

		vi.setSystemTime(1_100);
		expect(guard.canActivate(context)).toBe(true);
		expect(() => guard.canActivate(context)).toThrow(
			DomainRateLimitExceededError,
		);
	});
});
