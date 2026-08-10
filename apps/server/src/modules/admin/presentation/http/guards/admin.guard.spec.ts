import { type ExecutionContext, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	ADMIN_ORIGIN: "https://admin.wandit.test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import { AdminGuard } from "./admin.guard";

function contextFor({
	contentType = "application/json",
	method = "POST",
	origin,
	role = "admin",
}: {
	contentType?: string;
	method?: string;
	origin?: string;
	role?: string;
}): ExecutionContext {
	return {
		switchToHttp: () => ({
			getRequest: () => ({
				headers: {
					"content-type": contentType,
					...(origin === undefined ? {} : { origin }),
				},
				method,
				user: { role },
			}),
		}),
	} as unknown as ExecutionContext;
}

describe("AdminGuard", () => {
	const guard = new AdminGuard();

	it("allows JSON writes from the configured admin origin", () => {
		expect(
			guard.canActivate(contextFor({ origin: "https://admin.wandit.test" })),
		).toBe(true);
	});

	it("rejects writes with no Origin header", () => {
		expect(() => guard.canActivate(contextFor({}))).toThrow(NotFoundException);
	});

	it("rejects writes from the web-app origin", () => {
		expect(() =>
			guard.canActivate(contextFor({ origin: "https://wandit.test" })),
		).toThrow(NotFoundException);
	});

	it("rejects non-JSON writes from the admin origin", () => {
		expect(() =>
			guard.canActivate(
				contextFor({
					contentType: "application/x-www-form-urlencoded",
					origin: "https://admin.wandit.test",
				}),
			),
		).toThrow(NotFoundException);
	});

	it("allows safe reads without an Origin header", () => {
		expect(guard.canActivate(contextFor({ method: "GET" }))).toBe(true);
	});
});
