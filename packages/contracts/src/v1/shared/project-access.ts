/**
 * Workspace kinds, project roles, and the project "Workspace access" values (workspaces-sharing.md 2.2).
 * `v1/projects.ts`, `v1/workspaces.ts`, and `v2/sharing.ts` all read this file.
 * It imports no other contract file, so those three files never import each other in a cycle.
 */
import { z } from "zod";

/**
 * Kind of a workspace. `personal`: exactly one owner, and the owner's personal
 * credit pool pays. `team`: a Business organization, and the org pool pays.
 */
export const workspaceKinds = ["personal", "team"] as const;

/** Runtime validator for a workspace kind. */
export const workspaceKindSchema = z.enum(workspaceKinds);

/** TypeScript workspace kind. */
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;

/**
 * Effective role of a user on one project, highest first. UI labels: Owner,
 * Admin, Can edit (`editor`), Can view (`viewer`). No role answers 404.
 */
export const projectRoles = ["owner", "admin", "editor", "viewer"] as const;

/** Runtime validator for an effective project role. */
export const projectRoleSchema = z.enum(projectRoles);

/** TypeScript effective project role. */
export type ProjectRole = z.infer<typeof projectRoleSchema>;

/**
 * Role of a direct project grant: a member row, an invitation, or an invite link.
 * Same UI labels as `projectRoles`. The owner is never a grant.
 */
export const projectMemberRoles = ["admin", "editor", "viewer"] as const;

/** Runtime validator for a direct project grant role. */
export const projectMemberRoleSchema = z.enum(projectMemberRoles);

/** TypeScript direct project grant role. */
export type ProjectMemberRole = z.infer<typeof projectMemberRoleSchema>;

/**
 * Roles a project invite link can grant: Can edit or Can view. An admin grant
 * needs an email invitation, so a leaked link never gives admin power.
 */
export const projectInviteLinkRoles = ["editor", "viewer"] as const;

/** Runtime validator for a project invite link role. */
export const projectInviteLinkRoleSchema = z.enum(projectInviteLinkRoles);

/** TypeScript project invite link role. */
export type ProjectInviteLinkRole = z.infer<typeof projectInviteLinkRoleSchema>;

/**
 * The project "Workspace access" row. `can_edit`: workspace Editors can edit.
 * `can_view`: workspace Editors can only view. `restricted`: only the workspace
 * owner, the creator, and people with a direct grant can open the project.
 */
export const projectWorkspaceAccesses = [
	"can_edit",
	"can_view",
	"restricted",
] as const;

/** Runtime validator for a Workspace access value. */
export const projectWorkspaceAccessSchema = z.enum(projectWorkspaceAccesses);

/** TypeScript Workspace access value. */
export type ProjectWorkspaceAccess = z.infer<
	typeof projectWorkspaceAccessSchema
>;

/** The workspace that holds a project, as the project cards and the Share dialog show it. */
export const projectWorkspaceSchema = z.object({
	// Organization id. A personal project gives the personal org of `projects.user_id`.
	id: z.string(),
	name: z.string(),
	kind: workspaceKindSchema,
});

/** TypeScript project workspace. */
export type ProjectWorkspace = z.infer<typeof projectWorkspaceSchema>;

/**
 * The caller's access to one project. The web reads `role` for every V2 panel,
 * never the role of the workspace header.
 */
export const projectAccessSchema = z.object({
	role: projectRoleSchema,
	workspaceAccess: projectWorkspaceAccessSchema,
	workspace: projectWorkspaceSchema,
});

/** TypeScript project access. */
export type ProjectAccess = z.infer<typeof projectAccessSchema>;
