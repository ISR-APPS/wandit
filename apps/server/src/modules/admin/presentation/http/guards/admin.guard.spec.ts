import {
	type ExecutionContext,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { AdminPermissionRequest } from "@wandit/auth/admin-permissions";
import { ADMIN_PERMISSION_REQUIRED_ERROR_CODE } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	ADMIN_ORIGIN: "https://admin.wandit.test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import { ADMIN_PERMISSION_KEY } from "../decorators/admin-permission.decorator";
import { AdminGuard } from "./admin.guard";

type GuardSetup = {
	guard: AdminGuard;
	reflector: {
		getAllAndOverride: ReturnType<typeof vi.fn>;
	};
};

function setup(): GuardSetup {
	const reflector = {
		getAllAndOverride: vi.fn(
			(key: string | symbol, targets: readonly object[]) => {
				for (const target of targets) {
					const value = Reflect.getMetadata(key, target);

					if (value !== undefined) return value;
				}

				return undefined;
			},
		),
	};

	return {
		guard: new AdminGuard(reflector as unknown as Reflector),
		reflector,
	};
}

function contextFor(options: {
	classPermission?: AdminPermissionRequest;
	contentType?: string;
	handlerPermission?: AdminPermissionRequest;
	method?: string;
	origin?: string;
	role?: string;
}): ExecutionContext {
	const contentType = options.contentType ?? "application/json";
	const method = options.method ?? "POST";
	const origin = options.origin;
	const role = "role" in options ? options.role : "admin";
	const controller = class TestController {};
	const handler = function testHandler() {};

	if (options.classPermission !== undefined) {
		Reflect.defineMetadata(
			ADMIN_PERMISSION_KEY,
			options.classPermission,
			controller,
		);
	}

	if (options.handlerPermission !== undefined) {
		Reflect.defineMetadata(
			ADMIN_PERMISSION_KEY,
			options.handlerPermission,
			handler,
		);
	}

	return {
		getClass: () => controller,
		getHandler: () => handler,
		switchToHttp: () => ({
			getRequest: () => ({
				headers: {
					"content-type": contentType,
					...(origin === undefined ? {} : { origin }),
				},
				method,
				user: role === undefined ? undefined : { role },
			}),
		}),
	} as unknown as ExecutionContext;
}

function expectPermissionError(run: () => unknown): void {
	try {
		run();
		throw new Error("Expected AdminGuard to reject the request");
	} catch (error) {
		expect(error).toBeInstanceOf(ForbiddenException);
		expect((error as ForbiddenException).getResponse()).toMatchObject({
			code: ADMIN_PERMISSION_REQUIRED_ERROR_CODE,
		});
	}
}

describe("AdminGuard", () => {
	it.each([
		"user",
		"",
		undefined,
	])("hides safe reads from non-staff role %s", (role) => {
		const { guard } = setup();

		expect(() =>
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["read"] },
					method: "GET",
					role,
				}),
			),
		).toThrow(NotFoundException);
	});

	it.each([
		"user",
		"",
		undefined,
	])("hides writes from non-staff role %s", (role) => {
		const { guard } = setup();

		expect(() =>
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["ban"] },
					origin: "https://admin.wandit.test",
					role,
				}),
			),
		).toThrow(NotFoundException);
	});

	it("defaults routes without metadata to full-admin-only", () => {
		const { guard } = setup();

		expectPermissionError(() =>
			guard.canActivate(contextFor({ method: "GET", role: "support" })),
		);
		expect(
			guard.canActivate(contextFor({ method: "GET", role: "admin" })),
		).toBe(true);
	});

	it("allows support permissions and rejects permissions outside its matrix", () => {
		const allowed = setup();
		const denied = setup();

		expect(
			allowed.guard.canActivate(
				contextFor({
					handlerPermission: { users: ["read"] },
					method: "GET",
					role: "support",
				}),
			),
		).toBe(true);
		expectPermissionError(() =>
			denied.guard.canActivate(
				contextFor({
					handlerPermission: { users: ["set-role"] },
					method: "GET",
					role: "support",
				}),
			),
		);
	});

	it("uses handler permission metadata before class permission metadata", () => {
		const { guard } = setup();

		expectPermissionError(() =>
			guard.canActivate(
				contextFor({
					classPermission: { users: ["read"] },
					handlerPermission: { users: ["set-role"] },
					method: "GET",
					role: "support",
				}),
			),
		);
	});

	it("falls back to class permission metadata when the handler has none", () => {
		const { guard } = setup();

		expect(
			guard.canActivate(
				contextFor({
					classPermission: { users: ["read"] },
					method: "GET",
					role: "support",
				}),
			),
		).toBe(true);
	});

	it("allows a comma-joined stored role when any component grants access", () => {
		const { guard } = setup();

		expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["read"] },
					method: "GET",
					role: "user,support",
				}),
			),
		).toBe(true);
	});

	it("allows JSON support writes from the configured admin origin", () => {
		const { guard } = setup();

		expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["ban"] },
					origin: "https://admin.wandit.test",
					role: "support",
				}),
			),
		).toBe(true);
	});

	it("rejects support writes with no Origin header", () => {
		const { guard } = setup();

		expect(() =>
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["ban"] },
					role: "support",
				}),
			),
		).toThrow(NotFoundException);
	});

	it("rejects support writes from the web-app origin", () => {
		const { guard } = setup();

		expect(() =>
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["ban"] },
					origin: "https://wandit.test",
					role: "support",
				}),
			),
		).toThrow(NotFoundException);
	});

	it("rejects non-JSON support writes from the admin origin", () => {
		const { guard } = setup();

		expect(() =>
			guard.canActivate(
				contextFor({
					contentType: "application/x-www-form-urlencoded",
					handlerPermission: { users: ["ban"] },
					origin: "https://admin.wandit.test",
					role: "support",
				}),
			),
		).toThrow(NotFoundException);
	});

	it("checks write CSRF requirements before looking up permissions", () => {
		const { guard, reflector } = setup();

		expect(() =>
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["set-role"] },
					role: "support",
				}),
			),
		).toThrow(NotFoundException);
		expect(reflector.getAllAndOverride).not.toHaveBeenCalled();
	});
});
