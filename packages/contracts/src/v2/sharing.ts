/**
 * Project sharing contracts of V2 app projects (workspaces-sharing.md 2.2 and 5).
 * The Share dialog, the settings panel, "Shared with me", and the invitation page read them.
 * The sharing controllers of apps/server parse their bodies with these schemas.
 * The role and access enums with their UI labels live in v1/shared/project-access.ts.
 */
import { z } from "zod";
import { projectSchema } from "../v1/projects";
import { isoDateTimeSchema, uuidSchema } from "../v1/shared/primitives";
import {
	projectAccessSchema,
	projectInviteLinkRoleSchema,
	projectMemberRoleSchema,
	projectRoleSchema,
	projectWorkspaceAccessSchema,
	projectWorkspaceSchema,
} from "../v1/shared/project-access";
import { inviteLinkTokenSchema } from "../v1/workspaces";

/** Lifecycle of a project invitation. Matches the `project_invitation_status` database enum. */
export const projectInvitationStatuses = [
	"pending",
	"accepted",
	"declined",
	"canceled",
] as const;

export const projectInvitationStatusSchema = z.enum(projectInvitationStatuses);

export type ProjectInvitationStatus = z.infer<
	typeof projectInvitationStatusSchema
>;

/** One person in the Share dialog: the owner or a direct grant. */
export const sharingPersonSchema = z.object({
	userId: z.string(),
	name: z.string(),
	// Not z.email(): one stored legacy address must not break the whole dialog.
	email: z.string(),
	// Avatar URL; null when the user has none.
	image: z.string().nullable(),
});

export type SharingPerson = z.infer<typeof sharingPersonSchema>;

/** A direct grant on the project: one `project_members` row. */
export const projectMemberSchema = sharingPersonSchema.extend({
	role: projectMemberRoleSchema,
	createdAt: isoDateTimeSchema,
});

export type ProjectMember = z.infer<typeof projectMemberSchema>;

/** A pending email invitation to the project, as editors and higher see it. */
export const projectInvitationSchema = z.object({
	id: uuidSchema,
	// Canonical email. The invite page URL is `/project-invite/<id>`.
	email: z.string(),
	role: projectMemberRoleSchema,
	// 30 days after creation.
	expiresAt: isoDateTimeSchema,
	createdAt: isoDateTimeSchema,
});

export type ProjectInvitation = z.infer<typeof projectInvitationSchema>;

/**
 * The active project invite link. The join page URL is `/join/<token>`.
 * `PUT /api/v2/projects/:id/invite-link` answers it.
 */
export const projectInviteLinkSchema = z.object({
	token: inviteLinkTokenSchema,
	role: projectInviteLinkRoleSchema,
	// 7 days after creation.
	expiresAt: isoDateTimeSchema,
});

export type ProjectInviteLink = z.infer<typeof projectInviteLinkSchema>;

/**
 * Answer of `GET /api/v2/projects/:id/sharing` (viewer and higher).
 * Token rule: only an editor or higher gets `invitations` and `inviteLink.token`.
 * A viewer who reads an editor link token could join again as an editor.
 */
export const projectSharingStateSchema = z.object({
	// The caller's effective role on this project.
	role: projectRoleSchema,
	// `projects.user_id`. In a personal workspace this is the workspace owner.
	owner: sharingPersonSchema,
	workspace: projectWorkspaceSchema,
	workspaceAccess: projectWorkspaceAccessSchema,
	// Direct grants only. Workspace members get access through `workspaceAccess`.
	members: z.array(projectMemberSchema),
	// Pending invitations. Absent for a viewer.
	invitations: z.array(projectInvitationSchema).optional(),
	// The active link; null when none. `token` is absent for a viewer.
	inviteLink: projectInviteLinkSchema.partial({ token: true }).nullable(),
});

export type ProjectSharingState = z.infer<typeof projectSharingStateSchema>;

/** Most emails one invitation request accepts. */
export const PROJECT_INVITATION_EMAILS_MAX = 20;

/**
 * Body of `POST /api/v2/projects/:id/invitations` (editor; the `admin` role
 * needs a project admin). The server makes each email canonical and sends one email each.
 */
export const createProjectInvitationsBodySchema = z.object({
	emails: z.array(z.email().max(320)).min(1).max(PROJECT_INVITATION_EMAILS_MAX),
	role: projectMemberRoleSchema,
});

export type CreateProjectInvitationsBody = z.infer<
	typeof createProjectInvitationsBodySchema
>;

/** Answer of the invitations POST: the pending invitations it created or renewed. */
export const createProjectInvitationsResponseSchema = z.object({
	invitations: z.array(projectInvitationSchema),
});

export type CreateProjectInvitationsResponse = z.infer<
	typeof createProjectInvitationsResponseSchema
>;

/**
 * Body of `PATCH /api/v2/projects/:id/members/:userId`. An editor changes only
 * editor and viewer grants; an admin or the owner changes every grant.
 * The route answers the updated `ProjectMember`.
 */
export const updateProjectMemberBodySchema = z.object({
	role: projectMemberRoleSchema,
});

export type UpdateProjectMemberBody = z.infer<
	typeof updateProjectMemberBodySchema
>;

/**
 * Body and answer of `PATCH /api/v2/projects/:id/workspace-access`.
 * Can edit and Can view need an editor; setting or clearing Restricted needs the owner.
 */
export const updateProjectWorkspaceAccessBodySchema = z.object({
	workspaceAccess: projectWorkspaceAccessSchema,
});

export type UpdateProjectWorkspaceAccessBody = z.infer<
	typeof updateProjectWorkspaceAccessBodySchema
>;

/**
 * Body of `PUT /api/v2/projects/:id/invite-link` (editor). The route revokes
 * the active link and answers the new `ProjectInviteLink`.
 */
export const putProjectInviteLinkBodySchema = z.object({
	role: projectInviteLinkRoleSchema,
});

export type PutProjectInviteLinkBody = z.infer<
	typeof putProjectInviteLinkBodySchema
>;

/**
 * Body of `POST /api/v2/projects/:id/transfer` (owner; team projects only).
 * The new owner is an owner, admin, or editor of the project's workspace.
 */
export const transferProjectBodySchema = z.object({
	newOwnerUserId: z.string().min(1),
});

export type TransferProjectBody = z.infer<typeof transferProjectBodySchema>;

/**
 * Body of `POST /api/v2/projects/:id/move`. Only the workspace owner of the
 * source can move a project, into a workspace where the caller can create projects.
 */
export const moveProjectBodySchema = z.object({
	// `personal` (PERSONAL_WORKSPACE: the caller's own personal workspace) or an organization id.
	destinationWorkspaceId: z.string().min(1),
	// True keeps direct grants and pending invitations. The move always revokes the project link.
	keepCollaborators: z.boolean(),
});

export type MoveProjectBody = z.infer<typeof moveProjectBodySchema>;

/**
 * Why a move answers 409 `PROJECT_MOVE_BLOCKED`. Each one holds money or
 * state of the source payer that a move would orphan.
 */
export const projectMoveBlockedReasons = [
	// A builder turn is in a non-terminal status, also `waiting`.
	"turn_active",
	// An `ai_usage_events` row of the project is still `reserved`.
	"usage_reserved",
	"publish_in_flight",
	"mobile_build_in_flight",
	"device_session_active",
	"custom_domain_attached",
	// The destination payer has no free backend slot for this project's backend.
	"backend_slot_unavailable",
] as const;

export const projectMoveBlockedReasonSchema = z.enum(projectMoveBlockedReasons);

export type ProjectMoveBlockedReason = z.infer<
	typeof projectMoveBlockedReasonSchema
>;

/** `details` of the 409 `PROJECT_MOVE_BLOCKED` error. */
export const projectMoveBlockedDetailsSchema = z.object({
	reason: projectMoveBlockedReasonSchema,
});

export type ProjectMoveBlockedDetails = z.infer<
	typeof projectMoveBlockedDetailsSchema
>;

/** A project with a direct grant for the caller. `access` is always present here. */
export const sharedProjectSchema = projectSchema.extend({
	access: projectAccessSchema,
});

export type SharedProject = z.infer<typeof sharedProjectSchema>;

/** Answer of `GET /api/v2/shared-projects`, the "Shared with me" section. */
export const listSharedProjectsResponseSchema = z.object({
	projects: z.array(sharedProjectSchema),
});

export type ListSharedProjectsResponse = z.infer<
	typeof listSharedProjectsResponseSchema
>;

/**
 * A project invitation as its invitee sees it. Every invitee route answers 404
 * unless the verified session email is the invitation email.
 */
export const receivedProjectInvitationSchema = z.object({
	id: uuidSchema,
	projectId: uuidSchema,
	projectName: z.string(),
	workspaceName: z.string(),
	role: projectMemberRoleSchema,
	// Name of the inviter, or the email when the name is empty.
	inviterName: z.string(),
	status: projectInvitationStatusSchema,
	// True when `expiresAt` is in the past. The server decides, not the browser clock.
	expired: z.boolean(),
	expiresAt: isoDateTimeSchema,
	createdAt: isoDateTimeSchema,
});

export type ReceivedProjectInvitation = z.infer<
	typeof receivedProjectInvitationSchema
>;

/** Answer of `GET /api/v2/project-invitations`: the caller's pending invitations. */
export const listReceivedProjectInvitationsResponseSchema = z.object({
	invitations: z.array(receivedProjectInvitationSchema),
});

export type ListReceivedProjectInvitationsResponse = z.infer<
	typeof listReceivedProjectInvitationsResponseSchema
>;

/** Answer of the invitation accept route. The web opens this project. */
export const acceptProjectInvitationResponseSchema = z.object({
	projectId: uuidSchema,
});

export type AcceptProjectInvitationResponse = z.infer<
	typeof acceptProjectInvitationResponseSchema
>;

/**
 * Route path builders of project sharing. These routes use the project role
 * of the caller, never the workspace header. Writes with no answer schema answer 204.
 */
export const projectSharingRoutes = {
	// GET the sharing state (viewer).
	sharing: (projectId: string) => `/api/v2/projects/${projectId}/sharing`,
	// POST invites 1 to 20 emails (editor).
	invitations: (projectId: string) =>
		`/api/v2/projects/${projectId}/invitations`,
	// DELETE cancels one pending invitation (editor).
	invitation: (projectId: string, invitationId: string) =>
		`/api/v2/projects/${projectId}/invitations/${invitationId}`,
	// PATCH changes the role of a direct grant; DELETE removes it. Everyone can remove their own grant.
	member: (projectId: string, userId: string) =>
		`/api/v2/projects/${projectId}/members/${userId}`,
	// PATCH sets Workspace access.
	workspaceAccess: (projectId: string) =>
		`/api/v2/projects/${projectId}/workspace-access`,
	// PUT creates the project link; DELETE revokes it (editor).
	inviteLink: (projectId: string) =>
		`/api/v2/projects/${projectId}/invite-link`,
	// POST transfers the project owner (owner; team projects only).
	transfer: (projectId: string) => `/api/v2/projects/${projectId}/transfer`,
	// POST moves the project to another workspace (workspace owner of the source).
	move: (projectId: string) => `/api/v2/projects/${projectId}/move`,
	// GET "Shared with me". Not under /v2/projects: `shared` would match `:projectId`.
	sharedProjects: "/api/v2/shared-projects",
	// GET the caller's pending project invitations.
	receivedInvitations: "/api/v2/project-invitations",
	// GET one invitation of the caller.
	receivedInvitation: (invitationId: string) =>
		`/api/v2/project-invitations/${invitationId}`,
	// POST accepts; answers `{ projectId }`.
	acceptInvitation: (invitationId: string) =>
		`/api/v2/project-invitations/${invitationId}/accept`,
	// POST declines.
	declineInvitation: (invitationId: string) =>
		`/api/v2/project-invitations/${invitationId}/decline`,
} as const;
