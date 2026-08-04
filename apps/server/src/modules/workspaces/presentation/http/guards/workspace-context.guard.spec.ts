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
	ORG_WORKSPACE_REQUIRED_KEY,
	PERSONAL_WORKSPACE_ONLY_KEY,
	WORKSPACE_PERMISSION_KEY,
} from "../decorators/workspace.decorators";
import { WorkspaceContextGuard } from "./workspace-context.guard";

const ORG_ID = "org_1";

type GuardSetup = {
	memberRole?: string | null;
	metadata?: Map<symbol, unknown>;
	header?: string;
	user?: { id: string } | undefined;
	isPublic?: boolean;
};

function buildContext(setup: GuardSetup) {
	const request: Record<string, unknown> = {
		headers: setup.header ? { [WORKSPACE_HEADER]: setup.header } : {},
		user: "user" in setup ? setup.user : { id: "user_1" },
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

	const members = {
		findMember: vi.fn(async () =>
			setup.memberRole == null
				? null
				: {
						createdAt: new Date(),
						id: "member_1",
						organizationId: ORG_ID,
						role: setup.memberRole,
						userId: "user_1",
					},
		),
	} as unknown as WorkspaceMembersRepository;

	return {
		guard: new WorkspaceContextGuard(members, reflector),
		context,
		request,
	};
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

	it("attaches org scope with parsed roles for members", async () => {
		const { guard, context, request } = buildContext({
			header: ORG_ID,
			memberRole: "admin,member",
		});

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(request.workspace).toEqual({
			kind: "org",
			organizationId: ORG_ID,
			role: "admin,member",
			roles: ["admin", "member"],
		});
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

	it("enforces workspace permissions for org members", async () => {
		const { guard, context } = buildContext({
			header: ORG_ID,
			memberRole: "member",
			metadata: new Map<symbol, unknown>([
				[WORKSPACE_PERMISSION_KEY, { actions: ["manage"], resource: "billing" }],
			]),
		});

		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
			WorkspacePermissionDeniedError,
		);
	});

	it("grants owner the billing permission", async () => {
		const { guard, context } = buildContext({
			header: ORG_ID,
			memberRole: "owner",
			metadata: new Map<symbol, unknown>([
				[WORKSPACE_PERMISSION_KEY, { actions: ["manage"], resource: "billing" }],
			]),
		});

		await expect(guard.canActivate(context)).resolves.toBe(true);
	});

	it("denies ADMIN the billing permission — money is owner-only", async () => {
		const { guard, context } = buildContext({
			header: ORG_ID,
			memberRole: "admin",
			metadata: new Map<symbol, unknown>([
				[WORKSPACE_PERMISSION_KEY, { actions: ["manage"], resource: "billing" }],
			]),
		});

		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
			WorkspacePermissionDeniedError,
		);
	});

	it("grants admin the non-money permissions (limits, domains)", async () => {
		const limits = buildContext({
			header: ORG_ID,
			memberRole: "admin",
			metadata: new Map<symbol, unknown>([
				[WORKSPACE_PERMISSION_KEY, { actions: ["manage"], resource: "limits" }],
			]),
		});
		await expect(limits.guard.canActivate(limits.context)).resolves.toBe(true);

		const domains = buildContext({
			header: ORG_ID,
			memberRole: "admin",
			metadata: new Map<symbol, unknown>([
				[WORKSPACE_PERMISSION_KEY, { actions: ["manage"], resource: "domain" }],
			]),
		});
		await expect(domains.guard.canActivate(domains.context)).resolves.toBe(
			true,
		);
	});

	it("bypasses role checks entirely in personal scope", async () => {
		const { guard, context } = buildContext({
			metadata: new Map<symbol, unknown>([
				[WORKSPACE_PERMISSION_KEY, { actions: ["manage"], resource: "billing" }],
			]),
		});

		await expect(guard.canActivate(context)).resolves.toBe(true);
	});

	it("rejects org scope on personal-only (legacy) routes", async () => {
		const { guard, context } = buildContext({
			header: ORG_ID,
			memberRole: "owner",
			metadata: new Map<symbol, unknown>([[PERSONAL_WORKSPACE_ONLY_KEY, true]]),
		});

		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
			WorkspaceNotSupportedError,
		);
	});

	it("rejects personal scope on org-only routes", async () => {
		const { guard, context } = buildContext({
			metadata: new Map<symbol, unknown>([[ORG_WORKSPACE_REQUIRED_KEY, true]]),
		});

		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
			WorkspaceNotSupportedError,
		);
	});

	it("member role passes project update but not project delete", async () => {
		const passes = buildContext({
			header: ORG_ID,
			memberRole: "member",
			metadata: new Map<symbol, unknown>([
				[WORKSPACE_PERMISSION_KEY, { actions: ["update"], resource: "project" }],
			]),
		});
		await expect(passes.guard.canActivate(passes.context)).resolves.toBe(true);

		const denied = buildContext({
			header: ORG_ID,
			memberRole: "member",
			metadata: new Map<symbol, unknown>([
				[WORKSPACE_PERMISSION_KEY, { actions: ["delete"], resource: "project" }],
			]),
		});
		await expect(denied.guard.canActivate(denied.context)).rejects.toBeInstanceOf(
			WorkspacePermissionDeniedError,
		);
	});
});
