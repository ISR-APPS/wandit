import type { ExecutionContext } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { WORKSPACE_HEADER } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { IS_PUBLIC_KEY } from "../../../../auth/presentation/http/decorators/public.decorator";
import {
	WorkspaceNotSupportedError,
	WorkspacePermissionDeniedError,
} from "../../../domain/errors/workspace.errors";
import type { WorkspaceMembersRepository } from "../../../infrastructure/persistence/members.repository";
import {
	PERSONAL_WORKSPACE_ONLY_KEY,
	WORKSPACE_PERMISSION_KEY,
	type WorkspacePermissionRequirement,
} from "../decorators/workspace.decorators";
import { WorkspaceContextGuard } from "./workspace-context.guard";

const ORG_ID = "org_1";
const CALLER_ID = "user_1";
const OTHER_USER_ID = "user_2";

type GuardSetup = {
	memberRole?: string | null;
	// Owner of the org in the header: the caller, another user, or null for a team org.
	personalOwnerUserId?: string | null;
	metadata?: Map<symbol, unknown>;
	header?: string;
	user?: { id: string } | undefined;
	isPublic?: boolean;
};

function buildContext(setup: GuardSetup) {
	const request: Record<string, unknown> = {
		headers: setup.header ? { [WORKSPACE_HEADER]: setup.header } : {},
		user: "user" in setup ? setup.user : { id: CALLER_ID },
	};

	const context = {
		getClass: () => class {},
		getHandler: () => function handler() {},
		switchToHttp: () => ({ getRequest: () => request }),
	} as unknown as ExecutionContext;

	const reflector = {
		getAllAndOverride: vi.fn((key: symbol) => {
			if (key === IS_PUBLIC_KEY) return setup.isPublic ?? false;
			return setup.metadata?.get(key);
		}),
	} as unknown as Reflector;

	const members: Pick<WorkspaceMembersRepository, "findMembership"> = {
		findMembership: async () =>
			setup.memberRole == null
				? null
				: {
						organizationId: ORG_ID,
						personalOwnerUserId: setup.personalOwnerUserId ?? null,
						role: setup.memberRole,
					},
	};

	return {
		// SAFETY: the guard calls only findMembership on the repository.
		guard: new WorkspaceContextGuard(
			members as WorkspaceMembersRepository,
			reflector,
		),
		context,
		request,
	};
}

function permission(
	resource: WorkspacePermissionRequirement["resource"],
	action: string,
): Map<symbol, unknown> {
	return new Map<symbol, unknown>([
		[WORKSPACE_PERMISSION_KEY, { actions: [action], resource }],
	]);
}

describe("WorkspaceContextGuard", () => {
	it("skips public routes entirely", async () => {
		const { guard, context, request } = buildContext({
			header: ORG_ID,
			isPublic: true,
			user: undefined,
		});

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(request.workspace).toBeUndefined();
	});

	it("resolves personal scope when the header is absent", async () => {
		const { guard, context, request } = buildContext({});

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(request.workspace).toEqual({ kind: "personal" });
	});

	it("resolves personal scope for the literal personal value", async () => {
		const { guard, context, request } = buildContext({ header: "personal" });

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(request.workspace).toEqual({ kind: "personal" });
	});

	it.each([
		{
			name: "the caller's own personal org",
			personalOwnerUserId: CALLER_ID,
			memberRole: "owner",
			expected: { kind: "personal" },
		},
		{
			name: "another user's personal org",
			personalOwnerUserId: OTHER_USER_ID,
			memberRole: "member",
			expected: {
				kind: "shared-personal",
				organizationId: ORG_ID,
				ownerUserId: OTHER_USER_ID,
				role: "member",
				roles: ["member"],
			},
		},
		{
			name: "a team org",
			personalOwnerUserId: null,
			memberRole: "admin,member",
			expected: {
				kind: "org",
				organizationId: ORG_ID,
				role: "admin,member",
				roles: ["admin", "member"],
			},
		},
	])("maps the header of $name", async ({
		personalOwnerUserId,
		memberRole,
		expected,
	}) => {
		const { guard, context, request } = buildContext({
			header: ORG_ID,
			memberRole,
			personalOwnerUserId,
		});

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(request.workspace).toEqual(expected);
	});

	it("hides foreign orgs behind 404, never 403", async () => {
		const { guard, context } = buildContext({
			header: ORG_ID,
			memberRole: null,
		});

		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it.each([
		// Money is owner-only in a team workspace.
		{
			owner: null,
			role: "owner",
			resource: "billing",
			action: "manage",
			allowed: true,
		},
		{
			owner: null,
			role: "admin",
			resource: "billing",
			action: "manage",
			allowed: false,
		},
		{
			owner: null,
			role: "member",
			resource: "billing",
			action: "manage",
			allowed: false,
		},
		{
			owner: null,
			role: "admin",
			resource: "limits",
			action: "manage",
			allowed: true,
		},
		{
			owner: null,
			role: "admin",
			resource: "domain",
			action: "manage",
			allowed: true,
		},
		{
			owner: null,
			role: "member",
			resource: "project",
			action: "update",
			allowed: true,
		},
		{
			owner: null,
			role: "member",
			resource: "project",
			action: "delete",
			allowed: false,
		},
		{
			owner: null,
			role: "viewer",
			resource: "project",
			action: "update",
			allowed: false,
		},
		// The owner's personal pool pays in a shared personal workspace: no role manages its money.
		{
			owner: OTHER_USER_ID,
			role: "owner",
			resource: "billing",
			action: "manage",
			allowed: false,
		},
		{
			owner: OTHER_USER_ID,
			role: "admin",
			resource: "limits",
			action: "manage",
			allowed: false,
		},
		{
			owner: OTHER_USER_ID,
			role: "member",
			resource: "project",
			action: "update",
			allowed: true,
		},
		{
			owner: OTHER_USER_ID,
			role: "viewer",
			resource: "project",
			action: "update",
			allowed: false,
		},
	] as const)("role $role in an org owned by $owner: $resource:$action allowed=$allowed", async ({
		owner,
		role,
		resource,
		action,
		allowed,
	}) => {
		const { guard, context } = buildContext({
			header: ORG_ID,
			memberRole: role,
			metadata: permission(resource, action),
			personalOwnerUserId: owner,
		});

		if (allowed) {
			await expect(guard.canActivate(context)).resolves.toBe(true);
		} else {
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
				WorkspacePermissionDeniedError,
			);
		}
	});

	it("bypasses role checks entirely in personal scope", async () => {
		const { guard, context } = buildContext({
			metadata: permission("billing", "manage"),
		});

		await expect(guard.canActivate(context)).resolves.toBe(true);
	});

	it.each([
		{ owner: null, allowed: false },
		{ owner: OTHER_USER_ID, allowed: false },
		{ owner: CALLER_ID, allowed: true },
	])("personal-only route in a workspace whose personal owner is $owner: allowed=$allowed", async ({
		owner,
		allowed,
	}) => {
		const { guard, context } = buildContext({
			header: ORG_ID,
			memberRole: "owner",
			metadata: new Map<symbol, unknown>([[PERSONAL_WORKSPACE_ONLY_KEY, true]]),
			personalOwnerUserId: owner,
		});

		if (allowed) {
			await expect(guard.canActivate(context)).resolves.toBe(true);
		} else {
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
				WorkspaceNotSupportedError,
			);
		}
	});
});
