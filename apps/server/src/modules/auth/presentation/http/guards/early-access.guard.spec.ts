import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import {
	EARLY_ACCESS_REQUIRED_ERROR_CODE,
	EarlyAccessGuard,
} from "./early-access.guard";

function contextFor(user: { earlyAccess?: boolean; role?: string }) {
	return {
		switchToHttp: () => ({
			getRequest: () => ({ user }),
		}),
	} as unknown as ExecutionContext;
}

describe("EarlyAccessGuard", () => {
	const guard = new EarlyAccessGuard();

	it("allows a user with the persisted early-access flag", () => {
		expect(
			guard.canActivate(contextFor({ earlyAccess: true, role: "user" })),
		).toBe(true);
	});

	it("allows an admin, including a comma-separated Better Auth role", () => {
		expect(
			guard.canActivate(contextFor({ earlyAccess: false, role: "user,admin" })),
		).toBe(true);
	});

	it("rejects a regular user with a typed 403", () => {
		expect.assertions(3);

		try {
			guard.canActivate(contextFor({ earlyAccess: false, role: "user" }));
		} catch (error) {
			expect(error).toBeInstanceOf(ForbiddenException);
			expect((error as ForbiddenException).getStatus()).toBe(403);
			expect((error as ForbiddenException).getResponse()).toMatchObject({
				code: EARLY_ACCESS_REQUIRED_ERROR_CODE,
				message: "Early access is required",
			});
		}
	});
});
