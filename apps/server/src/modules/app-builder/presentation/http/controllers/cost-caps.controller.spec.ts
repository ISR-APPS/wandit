import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import { updateProjectCostCapsRequestSchema } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import {
	PROJECT_ROLE_KEY,
	type ResolvedProjectAccess,
} from "../../../../projects";
import { WorkspacePermissionDeniedError } from "../../../../workspaces/domain/errors/workspace.errors";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { CostCapsController } from "./cost-caps.controller";

const CAPS = { monthlyCapCredits: 10_000, perTurnCapCredits: 5000 };

function setup() {
	const appProjects = {
		getCostCaps: vi.fn(async () => CAPS),
		updateCostCaps: vi.fn(async () => CAPS),
	};
	const controller = new CostCapsController(appProjects);

	return { appProjects, controller };
}

// SAFETY: the controller reads only `user.id` for the scope derivation.
const user = { id: "user_1" } as AuthUser;

/** An access of `user_1` with the given role, as ProjectAccessGuard attaches it. */
function accessOf(
	role: "admin" | "owner",
	organizationId: string | null,
): ResolvedProjectAccess {
	return {
		directRole: null,
		project: {
			engine: "v2_app",
			id: "project-1",
			organizationId,
			userId: role === "owner" ? "user_1" : "owner_1",
			workspaceAccess: "can_edit",
		},
		role,
		workspace: null,
		workspaceRoles: [role],
	};
}

describe("CostCapsController", () => {
	// The personal pool is the owner's money: a workspace admin there must not set caps.
	it.each([
		"get",
		"update",
	] as const)("%s answers 403 to an admin of a personal project", async (route) => {
		const { appProjects, controller } = setup();
		const access = accessOf("admin", null);
		const body = { monthlyCapCredits: null, perTurnCapCredits: null };

		const call =
			route === "get"
				? controller.get("project-1", user, access)
				: controller.update("project-1", body, user, access);

		await expect(call).rejects.toBeInstanceOf(WorkspacePermissionDeniedError);
		expect(appProjects.getCostCaps).not.toHaveBeenCalled();
		expect(appProjects.updateCostCaps).not.toHaveBeenCalled();
	});

	it.each([
		["the personal owner", accessOf("owner", null)],
		["a team admin", accessOf("admin", "org_1")],
	])("lets %s read the caps", async (_name, access) => {
		const { controller } = setup();

		await expect(controller.get("project-1", user, access)).resolves.toEqual(
			CAPS,
		);
	});
});

describe("CostCapsController route metadata", () => {
	it("applies V2BuilderEnabledGuard to the controller", () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, CostCapsController)).toEqual([
			V2BuilderEnabledGuard,
		]);
	});

	it("needs the admin role on both routes", () => {
		for (const handler of [
			CostCapsController.prototype.get,
			CostCapsController.prototype.update,
		]) {
			expect(Reflect.getMetadata(PROJECT_ROLE_KEY, handler)).toEqual({
				anyEngine: false,
				role: "admin",
			});
		}
	});

	// 250_001 cc is one over the `agent_session` reserve ceiling max in the schema.
	it("rejects a per-turn cap above the reserve ceiling in the body pipe", () => {
		expect(() =>
			new ZodValidationPipe(updateProjectCostCapsRequestSchema).transform(
				{ monthlyCapCredits: null, perTurnCapCredits: 250_001 },
				{ type: "body" },
			),
		).toThrow(BadRequestException);
	});
});
