import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import {
	type UpdateProjectCostCapsRequest,
	updateProjectCostCapsRequestSchema,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
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

const workspace: WorkspaceContext = { kind: "personal" };

describe("CostCapsController", () => {
	it("get delegates with the scope and the project id", async () => {
		const { appProjects, controller } = setup();

		const result = await controller.get("project-1", user, workspace);

		expect(appProjects.getCostCaps).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			"project-1",
		);
		expect(result).toEqual(CAPS);
	});

	it("update delegates with the scope, the project id, and the body", async () => {
		const { appProjects, controller } = setup();
		const body: UpdateProjectCostCapsRequest = {
			monthlyCapCredits: 20_000,
			perTurnCapCredits: null,
		};

		const result = await controller.update("project-1", body, user, workspace);

		expect(appProjects.updateCostCaps).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			"project-1",
			body,
		);
		expect(result).toEqual(CAPS);
	});
});

describe("CostCapsController route metadata", () => {
	it("applies V2BuilderEnabledGuard to the controller", () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, CostCapsController)).toEqual([
			V2BuilderEnabledGuard,
		]);
	});

	it("gates both routes on limits:manage", () => {
		for (const handler of [
			CostCapsController.prototype.get,
			CostCapsController.prototype.update,
		]) {
			expect(Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, handler)).toEqual({
				actions: ["manage"],
				resource: "limits",
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
