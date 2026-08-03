import { z } from "zod";
import { isoDateTimeSchema } from "./shared/primitives";

/**
 * Workspace scoping header — the ONLY scope authority for workspace-scoped
 * API routes (never a URL param, never the Better Auth session's
 * activeOrganizationId). Value: an organization id, or `personal`/absent for
 * the personal workspace.
 */
export const WORKSPACE_HEADER = "x-wandit-workspace";

export const PERSONAL_WORKSPACE = "personal" as const;

export const workspaceRoleNames = ["owner", "admin", "member"] as const;
export const workspaceRoleNameSchema = z.enum(workspaceRoleNames);
export type WorkspaceRoleName = z.infer<typeof workspaceRoleNameSchema>;

// A member's role value may be a comma-separated multi-role string
// (better-auth 1.6.22); expose the raw value plus the parsed list.
export const workspaceSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	logo: z.string().nullable(),
	role: z.string(),
	roles: z.array(workspaceRoleNameSchema),
	createdAt: isoDateTimeSchema,
});

export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;

export const listWorkspacesResponseSchema = z.object({
	workspaces: z.array(workspaceSummarySchema),
});

export type ListWorkspacesResponse = z.infer<
	typeof listWorkspacesResponseSchema
>;

export const workspaceMemberLimitSchema = z.object({
	userId: z.string(),
	name: z.string(),
	email: z.email(),
	monthlyCreditLimit: z.int().positive().nullable(),
	spentThisMonth: z.int().min(0),
});

export type WorkspaceMemberLimit = z.infer<typeof workspaceMemberLimitSchema>;

export const workspaceMemberLimitsResponseSchema = z.object({
	defaultMemberMonthlyCreditLimit: z.int().positive().nullable(),
	members: z.array(workspaceMemberLimitSchema),
});

export type WorkspaceMemberLimitsResponse = z.infer<
	typeof workspaceMemberLimitsResponseSchema
>;

export const putWorkspaceMemberLimitsBodySchema = z
	.object({
		defaultMemberMonthlyCreditLimit: z.int().positive().nullable().optional(),
		members: z
			.array(
				z.object({
					userId: z.string(),
					monthlyCreditLimit: z.int().positive().nullable(),
				}),
			)
			.max(200)
			.optional(),
	})
	.refine(
		(body) =>
			body.defaultMemberMonthlyCreditLimit !== undefined ||
			(body.members !== undefined && body.members.length > 0),
		{ message: "At least one limit change must be provided" },
	);

export type PutWorkspaceMemberLimitsBody = z.infer<
	typeof putWorkspaceMemberLimitsBodySchema
>;

export const memberCreditLimitDetailsSchema = z.object({
	limitCredits: z.int().positive(),
	spentCredits: z.int().min(0),
	requiredCredits: z.int().positive(),
});

export type MemberCreditLimitDetails = z.infer<
	typeof memberCreditLimitDetailsSchema
>;

// Workspace-scoped routes carry NO org URL param — scope comes from the
// header (teams-workspaces.md §2). Membership CRUD stays on Better Auth's
// /api/auth/organization/* routes.
export const workspacesRoutes = {
	list: "/api/v1/workspaces",
	memberLimits: "/api/v1/workspace/member-limits",
} as const;
