import { NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	adminStatement,
	adminViews,
	defaultSupportViews,
	supportStatementsForViews,
} from "@wandit/auth/admin-permissions";
import { adminMyPermissionsResponseSchema } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { AdminViewGrantsRepository } from "../../../infrastructure/persistence/admin-view-grants.repository";
import { AdminMeController } from "./admin-me.controller";

function setup(storedViews: string[] | null, databaseRole = "support") {
	const repository = {
		findSupportAccess: vi
			.fn()
			.mockResolvedValue({ role: databaseRole, views: storedViews }),
	};
	const controller = new AdminMeController(
		repository as unknown as AdminViewGrantsRepository,
	);

	return { controller, repository };
}

function user(role: string): AuthUser {
	return { id: "staff-1", role } as AuthUser;
}

describe("AdminMeController.permissions", () => {
	it("returns every view and the full matrix from the database-fresh admin role", async () => {
		const { controller, repository } = setup(["overview"], "user,admin");

		const response = await controller.permissions(user("user,admin"));

		expect(response).toEqual({
			permissions: adminStatement,
			role: "admin",
			views: adminViews,
		});
		expect(repository.findSupportAccess).toHaveBeenCalledWith("staff-1");
		expect(() =>
			adminMyPermissionsResponseSchema.parse(response),
		).not.toThrow();
	});

	it("returns a support user's filtered stored views and effective statements", async () => {
		const { controller, repository } = setup([
			"users",
			"conversations",
			"removed-view",
		]);

		const response = await controller.permissions(user("user,support"));

		expect(response).toEqual({
			permissions: supportStatementsForViews(["users", "conversations"]),
			role: "support",
			views: ["users", "conversations"],
		});
		expect(repository.findSupportAccess).toHaveBeenCalledWith("staff-1");
		expect(() =>
			adminMyPermissionsResponseSchema.parse(response),
		).not.toThrow();
	});

	it("uses the default support views when no grants row exists", async () => {
		const { controller } = setup(null);

		const response = await controller.permissions(user("support"));

		expect(response).toEqual({
			permissions: supportStatementsForViews(defaultSupportViews),
			role: "support",
			views: defaultSupportViews,
		});
		expect(() =>
			adminMyPermissionsResponseSchema.parse(response),
		).not.toThrow();
	});

	it("reports the database-fresh role and no permissions for a stale support session", async () => {
		const { controller } = setup(null, "user");

		const response = await controller.permissions(user("support"));

		expect(response).toEqual({
			permissions: {},
			role: "user",
			views: [],
		});
		expect(() =>
			adminMyPermissionsResponseSchema.parse(response),
		).not.toThrow();
	});

	it("404s when the database user has vanished", async () => {
		const { controller, repository } = setup(null);
		repository.findSupportAccess.mockResolvedValue(null);

		await expect(
			controller.permissions(user("support")),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
