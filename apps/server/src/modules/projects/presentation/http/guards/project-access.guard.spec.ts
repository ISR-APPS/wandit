import { NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import type { ProjectEngine, ProjectRole } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { WorkspacePermissionDeniedError } from "../../../../workspaces/domain/errors/workspace.errors";
import type { ResolvedProjectAccess } from "../../../domain/project-access";
import { RequireProjectRole } from "../decorators/project-access.decorators";
import { ProjectAccessGuard } from "./project-access.guard";

const PROJECT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

// Route handlers with the three kinds of metadata the guard reads.
class Routes {
	@RequireProjectRole("editor")
	v2Write() {}

	@RequireProjectRole("viewer", { anyEngine: true })
	anyEngineRead() {}

	open() {}
}

type FakeRequest = {
	params: { projectId: string };
	user?: { id: string };
	projectAccess?: ResolvedProjectAccess;
};

function accessOf(
	role: ProjectRole,
	engine: ProjectEngine,
): ResolvedProjectAccess {
	return {
		directRole: null,
		project: {
			engine,
			id: PROJECT_ID,
			organizationId: "org_1",
			userId: "creator",
			workspaceAccess: "can_edit",
		},
		role,
		workspace: null,
		workspaceRoles: [],
	};
}

function setup(
	route: keyof Routes,
	access: ResolvedProjectAccess | null,
	request: FakeRequest = {
		params: { projectId: PROJECT_ID },
		user: { id: "user_1" },
	},
) {
	const resolve = vi.fn(async () => access);
	const guard = new ProjectAccessGuard({ resolve }, new Reflector());
	const context = new ExecutionContextHost(
		[request],
		Routes,
		Routes.prototype[route],
	);

	return { context, guard, request, resolve };
}

describe("ProjectAccessGuard", () => {
	it("passes a route without @RequireProjectRole and resolves nothing", async () => {
		const { context, guard, resolve } = setup("open", null);

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(resolve).not.toHaveBeenCalled();
	});

	// A 404, not a 403: a caller without access must not learn that the id exists.
	it.each<[string, ResolvedProjectAccess | null, FakeRequest]>([
		[
			"no access",
			null,
			{ params: { projectId: PROJECT_ID }, user: { id: "user_1" } },
		],
		[
			"a V1 project on a V2 route",
			accessOf("owner", "v1_page"),
			{ params: { projectId: PROJECT_ID }, user: { id: "user_1" } },
		],
		[
			"a malformed project id",
			accessOf("owner", "v2_app"),
			{ params: { projectId: "not-a-uuid" }, user: { id: "user_1" } },
		],
		[
			"no signed-in user",
			accessOf("owner", "v2_app"),
			{ params: { projectId: PROJECT_ID } },
		],
	])("answers 404 for %s", async (_name, access, request) => {
		const { context, guard } = setup("v2Write", access, request);

		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(request.projectAccess).toBeUndefined();
	});

	it("answers 403 to a role below the route's role", async () => {
		const { context, guard, request } = setup(
			"v2Write",
			accessOf("viewer", "v2_app"),
		);

		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
			WorkspacePermissionDeniedError,
		);
		expect(request.projectAccess).toBeUndefined();
	});

	it.each<[string, keyof Routes, ResolvedProjectAccess]>([
		["an editor on a V2 write route", "v2Write", accessOf("editor", "v2_app")],
		[
			"a V1 project on an any-engine route",
			"anyEngineRead",
			accessOf("viewer", "v1_page"),
		],
	])("passes %s and attaches the access", async (_name, route, access) => {
		const { context, guard, request, resolve } = setup(route, access);

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(resolve).toHaveBeenCalledWith("user_1", PROJECT_ID);
		expect(request.projectAccess).toBe(access);
	});
});
