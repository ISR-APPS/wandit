/**
 * Workspace contracts: the scope header, the workspace list, member limits,
 * external collaborators, and workspace and project invite links.
 * The web workspace feature and the server workspaces module read them.
 * Membership and email invitations stay on Better Auth's /api/auth/organization/* routes.
 * The web parses those Better Auth answers with the member, organization, and invitation schemas.
 */
import { z } from "zod";
import { creditPayerSchema } from "../http/error-codes";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";
import {
	projectInviteLinkRoleSchema,
	projectMemberRoleSchema,
	workspaceKindSchema,
} from "./shared/project-access";

/**
 * Workspace scoping header — the ONLY scope authority for workspace-scoped
 * API routes (never a URL param, never the Better Auth session's
 * activeOrganizationId). Value: an organization id, or `personal`/absent for
 * the personal workspace.
 */
export const WORKSPACE_HEADER = "x-wandit-workspace";

export const PERSONAL_WORKSPACE = "personal" as const;

/**
 * Workspace roles (`member.role` values). UI labels: Owner, Admin, Editor, Viewer.
 * The Editor key stays `member`, the Better Auth default role, so no row changes.
 */
export const workspaceRoleNames = [
	"owner",
	"admin",
	"member",
	"viewer",
] as const;
export const workspaceRoleNameSchema = z.enum(workspaceRoleNames);
export type WorkspaceRoleName = z.infer<typeof workspaceRoleNameSchema>;

// A member's role value may be a comma-separated multi-role string
// (better-auth 1.7.16); expose the raw value plus the parsed list.
export const workspaceSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	logo: z.string().nullable(),
	role: z.string(),
	roles: z.array(workspaceRoleNameSchema),
	createdAt: isoDateTimeSchema,
	// `personal`: one user's personal workspace. The default keeps an older API answer valid.
	kind: workspaceKindSchema.default("team"),
	// True only for the caller's own personal workspace. The web selects it with
	// the scope id `personal` and sends no header. Another user's personal
	// workspace has `kind: "personal"` and `isOwnPersonal: false`.
	isOwnPersonal: z.boolean().default(false),
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
	// Limits are configured in WHOLE credits (deliberate admin UX); the server
	// stores them x100 as centi-credits and divides back on read.
	monthlyCreditLimit: z.int().positive().nullable(),
	// Decimal credits — consumption is fractional under pricing v4.
	spentThisMonth: z.number().min(0),
});

export type WorkspaceMemberLimit = z.infer<typeof workspaceMemberLimitSchema>;

export const workspaceMemberLimitsResponseSchema = z.object({
	defaultMemberMonthlyCreditLimit: z.int().positive().nullable(),
	members: z.array(workspaceMemberLimitSchema),
});

export type WorkspaceMemberLimitsResponse = z.infer<
	typeof workspaceMemberLimitsResponseSchema
>;

// Limit inputs stay whole credits; the server multiplies x100 on write.
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

// 403 details in decimal credits (spend and holds are fractional; the limit
// itself is configured whole but exposed through the same decimal boundary).
export const memberCreditLimitDetailsSchema = z.object({
	limitCredits: z.number().positive(),
	spentCredits: z.number().min(0),
	requiredCredits: z.number().positive(),
	// The pool whose limit refused the charge. Optional: older servers omit it.
	payer: creditPayerSchema.optional(),
});

export type MemberCreditLimitDetails = z.infer<
	typeof memberCreditLimitDetailsSchema
>;

/** One project of an external collaborator, with the role of the direct grant. */
export const workspaceCollaboratorProjectSchema = z.object({
	projectId: uuidSchema,
	projectName: z.string(),
	role: projectMemberRoleSchema,
});

export type WorkspaceCollaboratorProject = z.infer<
	typeof workspaceCollaboratorProjectSchema
>;

/**
 * A user with a direct grant on a project of this workspace, who is not a
 * workspace member. The list leaves out Restricted projects the caller cannot open.
 */
export const workspaceCollaboratorSchema = z.object({
	userId: z.string(),
	name: z.string(),
	// Not z.email(): one stored legacy address must not break the whole list.
	email: z.string(),
	// Avatar URL; null when the user has none.
	image: z.string().nullable(),
	projects: z.array(workspaceCollaboratorProjectSchema),
});

export type WorkspaceCollaborator = z.infer<typeof workspaceCollaboratorSchema>;

/** Answer of `GET /api/v1/workspace/collaborators` (owner and admin). */
export const listWorkspaceCollaboratorsResponseSchema = z.object({
	collaborators: z.array(workspaceCollaboratorSchema),
});

export type ListWorkspaceCollaboratorsResponse = z.infer<
	typeof listWorkspaceCollaboratorsResponseSchema
>;

/**
 * Token of a workspace or project invite link: 32 random bytes in base64url,
 * so 43 characters with no padding. Routes parse the path param with it.
 */
export const inviteLinkTokenSchema = z.base64url().length(43);

/**
 * Roles a workspace invite link can grant: Editor (`member`) or Viewer.
 * Owner and admin need an email invitation.
 */
export const workspaceInviteLinkRoles = ["member", "viewer"] as const;

export const workspaceInviteLinkRoleSchema = z.enum(workspaceInviteLinkRoles);

export type WorkspaceInviteLinkRole = z.infer<
	typeof workspaceInviteLinkRoleSchema
>;

/** One active workspace invite link. Only owners and admins can read it. */
export const workspaceInviteLinkSchema = z.object({
	id: uuidSchema,
	token: inviteLinkTokenSchema,
	role: workspaceInviteLinkRoleSchema,
	// 5 days after creation.
	expiresAt: isoDateTimeSchema,
	createdAt: isoDateTimeSchema,
});

export type WorkspaceInviteLink = z.infer<typeof workspaceInviteLinkSchema>;

/** Answer of `GET /api/v1/workspace/invite-links`: at most one active link per role. */
export const listWorkspaceInviteLinksResponseSchema = z.object({
	links: z.array(workspaceInviteLinkSchema),
});

export type ListWorkspaceInviteLinksResponse = z.infer<
	typeof listWorkspaceInviteLinksResponseSchema
>;

/**
 * Body of `POST /api/v1/workspace/invite-links`. The route revokes the active
 * link of that role and answers the new `WorkspaceInviteLink`.
 */
export const createWorkspaceInviteLinkBodySchema = z.object({
	role: workspaceInviteLinkRoleSchema,
});

export type CreateWorkspaceInviteLinkBody = z.infer<
	typeof createWorkspaceInviteLinkBodySchema
>;

/**
 * Answer of `GET /api/v1/invite-links/:token`, the join page preview. An
 * unknown or revoked token answers 404 `INVITE_LINK_INVALID`; an expired one
 * answers this preview with `expired: true`.
 */
export const inviteLinkPreviewSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("workspace"),
		workspaceName: z.string(),
		role: workspaceInviteLinkRoleSchema,
		// Name of the link creator, or the email when the name is empty.
		inviterName: z.string(),
		expired: z.boolean(),
	}),
	z.object({
		kind: z.literal("project"),
		projectName: z.string(),
		role: projectInviteLinkRoleSchema,
		// Name of the link creator, or the email when the name is empty.
		inviterName: z.string(),
		expired: z.boolean(),
	}),
]);

export type InviteLinkPreview = z.infer<typeof inviteLinkPreviewSchema>;

/**
 * Answer of `POST /api/v1/invite-links/:token/accept`. The web opens the
 * workspace or the project. An existing member or grant is never downgraded.
 */
export const acceptInviteLinkResponseSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("workspace"), organizationId: z.string() }),
	z.object({ kind: z.literal("project"), projectId: uuidSchema }),
]);

export type AcceptInviteLinkResponse = z.infer<
	typeof acceptInviteLinkResponseSchema
>;

/**
 * One member row of the Better Auth answer `organization/get-full-organization`.
 * The web People page parses it. `role` can be a comma-separated list of role names.
 */
export const workspaceMemberSchema = z.object({
	// `member.id`: remove-member and update-member-role take it, not the user id.
	id: z.string(),
	userId: z.string(),
	role: z.string(),
	user: z.object({
		name: z.string(),
		// Not z.email(): one stored legacy address must not break the whole list.
		email: z.string(),
	}),
});

/**
 * The fields the web reads from a Better Auth organization answer.
 * `organization/create` answers `members` without `user`, so the create dialog parses only `id`.
 */
export const workspaceOrganizationSchema = z.object({
	id: z.string(),
	members: z.array(workspaceMemberSchema),
});

export type WorkspaceOrganization = z.infer<typeof workspaceOrganizationSchema>;

/**
 * One email invitation from a Better Auth answer: list-invitations,
 * list-user-invitations, or get-invitation. `role` can be a comma-separated list.
 */
export const workspaceInvitationSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	// Not z.email(): one stored legacy address must not break the whole list.
	email: z.string(),
	role: z.string(),
	status: z.enum(["pending", "accepted", "rejected", "canceled"]),
	// The Better Auth client turns ISO strings into Date objects. Coerce accepts both forms.
	expiresAt: z.coerce.date(),
	// Only list-user-invitations and get-invitation add the workspace name.
	organizationName: z.string().optional(),
});

export type WorkspaceInvitation = z.infer<typeof workspaceInvitationSchema>;

// Workspace-scoped routes carry NO org URL param — scope comes from the
// header (teams-workspaces.md §2). Membership CRUD stays on Better Auth's
// /api/auth/organization/* routes. The /invite-links/:token routes are not
// workspace-scoped: the token names the workspace or the project.
export const workspacesRoutes = {
	// GET the own personal workspace first, then every membership.
	list: "/api/v1/workspaces",
	memberLimits: "/api/v1/workspace/member-limits",
	// GET external collaborators on the projects of this workspace (owner and admin).
	collaborators: "/api/v1/workspace/collaborators",
	// GET the active links; POST creates one (owner and admin).
	inviteLinks: "/api/v1/workspace/invite-links",
	// DELETE revokes one link (owner and admin).
	inviteLink: (linkId: string) => `/api/v1/workspace/invite-links/${linkId}`,
	// GET the preview of a workspace or project link (any signed-in user).
	inviteLinkPreview: (token: string) => `/api/v1/invite-links/${token}`,
	// POST joins through the link (signed-in user with a verified email).
	acceptInviteLink: (token: string) => `/api/v1/invite-links/${token}/accept`,
} as const;
