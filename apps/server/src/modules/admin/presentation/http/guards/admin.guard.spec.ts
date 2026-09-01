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

import type { AdminViewGrantsRepository } from "../../../infrastructure/persistence/admin-view-grants.repository";
import { ADMIN_PERMISSION_KEY } from "../decorators/admin-permission.decorator";
import { AdminGuard } from "./admin.guard";

type PermissionMetadata = AdminPermissionRequest | "any-staff";

function setup(storedViews: string[] | null = null) {
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
	const repository = {
		findSupportAccess: vi
			.fn()
			.mockResolvedValue({ role: "support", views: storedViews }),
	};

	return {
		guard: new AdminGuard(
			reflector as unknown as Reflector,
			repository as unknown as AdminViewGrantsRepository,
		),
		reflector,
		repository,
	};
}

function contextFor(options: {
	classPermission?: PermissionMetadata;
	contentType?: string;
	handlerPermission?: PermissionMetadata;
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
				user: role === undefined ? undefined : { id: "staff-1", role },
			}),
		}),
	} as unknown as ExecutionContext;
}

async function expectPermissionError(
	run: () => Promise<unknown>,
): Promise<void> {
	const error = await run().then(
		() => new Error("Expected AdminGuard to reject the request"),
		(reason: unknown) => reason,
	);

	expect(error).toBeInstanceOf(ForbiddenException);
	expect((error as ForbiddenException).getResponse()).toMatchObject({
		code: ADMIN_PERMISSION_REQUIRED_ERROR_CODE,
	});
}

describe("AdminGuard", () => {
	it.each([
		"user",
		"",
		undefined,
	])("hides safe reads from non-staff role %s", async (role) => {
		const { guard } = setup();

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["read"] },
					method: "GET",
					role,
				}),
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it.each([
		"user",
		"",
		undefined,
	])("hides writes from non-staff role %s", async (role) => {
		const { guard } = setup();

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["ban"] },
					origin: "https://admin.wandit.test",
					role,
				}),
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("defaults routes without metadata to full-admin-only without reading grants", async () => {
		const support = setup(["users"]);
		const admin = setup([]);

		await expectPermissionError(() =>
			support.guard.canActivate(contextFor({ method: "GET", role: "support" })),
		);
		await expect(
			admin.guard.canActivate(contextFor({ method: "GET", role: "admin" })),
		).resolves.toBe(true);
		expect(support.repository.findSupportAccess).toHaveBeenCalledWith(
			"staff-1",
		);
		expect(admin.repository.findSupportAccess).not.toHaveBeenCalled();
	});

	it("uses stored support views for granted and ungranted routes", async () => {
		const granted = setup(["users"]);
		const denied = setup(["users"]);

		await expect(
			granted.guard.canActivate(
				contextFor({
					handlerPermission: { users: ["read"] },
					method: "GET",
					role: "support",
				}),
			),
		).resolves.toBe(true);
		await expectPermissionError(() =>
			denied.guard.canActivate(
				contextFor({
					handlerPermission: { feedback: ["read"] },
					method: "GET",
					role: "support",
				}),
			),
		);
		expect(granted.repository.findSupportAccess).toHaveBeenCalledWith(
			"staff-1",
		);
	});

	it("does not grant actions outside a granted view's support actions", async () => {
		const { guard } = setup(["users"]);

		await expectPermissionError(() =>
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["set-role"] },
					method: "GET",
					role: "support",
				}),
			),
		);
	});

	it("uses default support views when no grants row exists", async () => {
		const { guard } = setup(null);

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { overview: ["read"] },
					method: "GET",
					role: "support",
				}),
			),
		).resolves.toBe(true);
	});

	it("accepts any-staff metadata without reading grants", async () => {
		const { guard, repository } = setup([]);

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: "any-staff",
					method: "GET",
					role: "support",
				}),
			),
		).resolves.toBe(true);
		expect(repository.findSupportAccess).not.toHaveBeenCalled();
	});

	it.each([
		null,
		[],
	])("does not read grants for an admin when the stub contains %j", async (storedViews) => {
		const { guard, repository } = setup(storedViews);

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { settings: ["manage"] },
					method: "GET",
					role: "user,admin",
				}),
			),
		).resolves.toBe(true);
		expect(repository.findSupportAccess).not.toHaveBeenCalled();
	});

	it("uses handler permission metadata before class permission metadata", async () => {
		const { guard } = setup(["users"]);

		await expectPermissionError(() =>
			guard.canActivate(
				contextFor({
					classPermission: { users: ["read"] },
					handlerPermission: { feedback: ["read"] },
					method: "GET",
					role: "support",
				}),
			),
		);
	});

	it("falls back to class permission metadata when the handler has none", async () => {
		const { guard } = setup(["users"]);

		await expect(
			guard.canActivate(
				contextFor({
					classPermission: { users: ["read"] },
					method: "GET",
					role: "support",
				}),
			),
		).resolves.toBe(true);
	});

	it("allows a comma-joined stored role when its support component grants access", async () => {
		const { guard } = setup(["users"]);

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["read"] },
					method: "GET",
					role: "user,support",
				}),
			),
		).resolves.toBe(true);
	});

	it("allows JSON support writes from the configured admin origin", async () => {
		const { guard } = setup(["users"]);

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["ban"] },
					origin: "https://admin.wandit.test",
					role: "support",
				}),
			),
		).resolves.toBe(true);
	});

	it.each([
		{ label: "no Origin header", origin: undefined },
		{ label: "the web-app origin", origin: "https://wandit.test" },
	])("rejects support writes from $label", async ({ origin }) => {
		const { guard } = setup(["users"]);

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["ban"] },
					origin,
					role: "support",
				}),
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("rejects non-JSON support writes from the admin origin", async () => {
		const { guard } = setup(["users"]);

		await expect(
			guard.canActivate(
				contextFor({
					contentType: "application/x-www-form-urlencoded",
					handlerPermission: { users: ["ban"] },
					origin: "https://admin.wandit.test",
					role: "support",
				}),
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("checks write CSRF requirements before looking up permissions", async () => {
		const { guard, reflector, repository } = setup(["users"]);

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["set-role"] },
					role: "support",
				}),
			),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(reflector.getAllAndOverride).not.toHaveBeenCalled();
		expect(repository.findSupportAccess).not.toHaveBeenCalled();
	});

	it("404s a stale support session after the database role was demoted", async () => {
		const { guard, repository } = setup(["users"]);
		repository.findSupportAccess.mockResolvedValue({
			role: "user",
			views: null,
		});

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["read"] },
					method: "GET",
					role: "support",
				}),
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("uses the full matrix when a support session's database role is now admin", async () => {
		const { guard, repository } = setup(null);
		repository.findSupportAccess.mockResolvedValue({
			role: "admin",
			views: null,
		});

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["set-role"] },
					method: "GET",
					role: "support",
				}),
			),
		).resolves.toBe(true);
	});

	it("404s a support session when the database user has vanished", async () => {
		const { guard, repository } = setup();
		repository.findSupportAccess.mockResolvedValue(null);

		await expect(
			guard.canActivate(
				contextFor({
					handlerPermission: { users: ["read"] },
					method: "GET",
					role: "support",
				}),
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
