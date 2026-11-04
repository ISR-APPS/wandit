import type { ModuleRef } from "@nestjs/core";
import type { ProjectRole } from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TurnsService } from "../../../app-builder";
import type {
	ProjectAccessService,
	ResolvedProjectAccess,
} from "../../../projects";
import type { WorkspaceMembersRepository } from "../../infrastructure/persistence/members.repository";
import type {
	MembershipCleanupRepository,
	OpenTurnRow,
} from "../../infrastructure/persistence/membership-cleanup.repository";
import { MembershipCleanupService } from "./membership-cleanup.service";

const LOST_USER_ID = "user_lost";
const MANAGER_USER_ID = "user_manager";

function openTurn(overrides: Partial<OpenTurnRow> = {}): OpenTurnRow {
	return {
		projectId: "project_1",
		projectOrganizationId: "org_1",
		projectUserId: "user_creator",
		turnId: "turn_1",
		...overrides,
	};
}

function accessWithRole(role: ProjectRole): ResolvedProjectAccess {
	return {
		directRole: null,
		project: {
			engine: "v2_app",
			id: "project_1",
			organizationId: "org_1",
			userId: "user_creator",
			workspaceAccess: "can_edit",
		},
		role,
		workspace: null,
		workspaceRoles: [],
	};
}

function setup(input: {
	turns: OpenTurnRow[];
	/** Role that the lost user still holds on every project. Null: no access at all. */
	remainingRole: ProjectRole | null;
	/** Turn ids whose cancel throws. */
	failingTurnIds?: string[];
}) {
	const startedCancels: string[] = [];
	const finishedCancels: string[] = [];
	const cancelScopes: Parameters<TurnsService["cancel"]>[0][] = [];

	const turnsService: Pick<TurnsService, "cancel"> = {
		cancel: async (scope, _projectId, turnId) => {
			startedCancels.push(turnId);
			cancelScopes.push(scope);
			if (input.failingTurnIds?.includes(turnId)) {
				throw new Error(`cancel of ${turnId} failed`);
			}
			// A later macrotask: a service that throws before all cancels end does not see this push.
			await new Promise((resolve) => setTimeout(resolve, 0));
			finishedCancels.push(turnId);
			return { status: "canceled", turnId };
		},
	};
	const moduleRef: Pick<ModuleRef, "get"> = {
		// SAFETY: the service asks ModuleRef only for TurnsService, and the fake has its `cancel`.
		get: <TResult>(): TResult => turnsService as TResult,
	};
	const cleanup: Pick<MembershipCleanupRepository, "listOpenTurns"> = {
		listOpenTurns: async () => input.turns,
	};
	const projectAccess: Pick<ProjectAccessService, "resolve"> = {
		resolve: async () =>
			input.remainingRole === null ? null : accessWithRole(input.remainingRole),
	};

	const service = new MembershipCleanupService(
		// SAFETY: cancelProjectTurnsWithoutEditAccess reads only listOpenTurns.
		cleanup as MembershipCleanupRepository,
		// SAFETY: cancelProjectTurnsWithoutEditAccess never reads the members repository.
		{} as WorkspaceMembersRepository,
		// SAFETY: the cancel loop calls only resolve.
		projectAccess as ProjectAccessService,
		// SAFETY: the cancel loop calls only get.
		moduleRef as ModuleRef,
	);

	return { cancelScopes, finishedCancels, service, startedCancels };
}

function cancelTurnsOfLostUser(service: MembershipCleanupService) {
	return service.cancelProjectTurnsWithoutEditAccess({
		actorUserId: MANAGER_USER_ID,
		ipAddress: "203.0.113.9",
		projectId: "project_1",
		userId: LOST_USER_ID,
	});
}

describe("MembershipCleanupService turn cancels", () => {
	// No V2 module means no turns, so the service skips the cancel loop without the flag.
	beforeEach(() => {
		vi.stubEnv("V2_BUILDER_ENABLED", "true");
	});
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	// A missed cancel lets a `waiting` turn start later on the payer's pool.
	it.each([
		{ remainingRole: null, cancels: true },
		{ remainingRole: "viewer", cancels: true },
		{ remainingRole: "editor", cancels: false },
	] as const)("cancels the turn when the remaining project role is $remainingRole: $cancels", async ({
		remainingRole,
		cancels,
	}) => {
		const { service, startedCancels } = setup({
			remainingRole,
			turns: [openTurn()],
		});

		await cancelTurnsOfLostUser(service);

		expect(startedCancels).toEqual(cancels ? ["turn_1"] : []);
	});

	// A personal scope shows a Restricted project only to its owner, so the owner must act there.
	it.each([
		{
			projectOrganizationId: null,
			scope: {
				actorIsLimitExempt: false,
				actorRoles: ["owner"],
				actorUserId: "user_creator",
				kind: "personal",
				ownerUserId: "user_creator",
			},
		},
		{
			projectOrganizationId: "org_1",
			scope: {
				actorIsLimitExempt: false,
				actorRoles: ["owner"],
				actorUserId: MANAGER_USER_ID,
				kind: "org",
				organizationId: "org_1",
			},
		},
	])("cancels in the $scope.kind scope for a project with organization $projectOrganizationId", async ({
		projectOrganizationId,
		scope,
	}) => {
		const { cancelScopes, service } = setup({
			remainingRole: null,
			turns: [openTurn({ projectOrganizationId })],
		});

		await cancelTurnsOfLostUser(service);

		expect(cancelScopes).toEqual([scope]);
	});

	it("runs every cancel to the end before it throws for a failed cancel", async () => {
		const { finishedCancels, service, startedCancels } = setup({
			failingTurnIds: ["turn_1"],
			remainingRole: null,
			turns: [openTurn({ turnId: "turn_1" }), openTurn({ turnId: "turn_2" })],
		});

		await expect(cancelTurnsOfLostUser(service)).rejects.toThrow(
			"1 turn cancels failed",
		);
		expect(startedCancels).toEqual(["turn_1", "turn_2"]);
		expect(finishedCancels).toEqual(["turn_2"]);
	});
});
