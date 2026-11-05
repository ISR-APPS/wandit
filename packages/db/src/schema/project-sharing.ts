/**
 * Sharing tables of V2 app projects and workspaces (workspaces-sharing.md 1 and 2.2).
 * `project_members` holds direct project grants, `project_invitations` holds email
 * invitations to one project, and `invite_links` holds workspace and project join links.
 * The sharing and invite-link services of apps/server read and write them through Drizzle.
 */
import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organizations";
import { projects } from "./projects";

/**
 * Role of a direct project grant. UI labels: Admin, Can edit, Can view.
 * The project owner is never a grant: `projects.user_id` and the workspace decide it.
 */
export const projectMemberRole = pgEnum("project_member_role", [
	"admin",
	"editor",
	"viewer",
]);

/** Lifecycle of a project email invitation. Only a `pending` row can change. */
export const projectInvitationStatus = pgEnum("project_invitation_status", [
	"pending",
	"accepted",
	"declined",
	"canceled",
]);

export const projectMembers = pgTable(
	"project_members",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Cascade: a grant has no meaning without its project.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		role: projectMemberRole("role").notNull(),
		// The user who sent the accepted invitation or link. NULL when unknown.
		invitedByUserId: text("invited_by_user_id").references(() => user.id, {
			onDelete: "restrict",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		// One grant per user and project: accept and role changes upsert this row.
		uniqueIndex("project_members_projectId_userId_uq").on(
			table.projectId,
			table.userId,
		),
		// "Shared with me" and the access resolver read the grants of one user.
		index("project_members_userId_idx").on(table.userId),
	],
);

export const projectInvitations = pgTable(
	"project_invitations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// Canonical lower-case email (canonicalizeEmail). Every invitee route
		// compares it with the verified session email.
		email: text("email").notNull(),
		role: projectMemberRole("role").notNull(),
		status: projectInvitationStatus("status").notNull().default("pending"),
		inviterUserId: text("inviter_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// 30 days after creation, the same as a workspace invitation.
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		// Set when the row leaves `pending`: accept, decline, or cancel.
		respondedAt: timestamp("responded_at", { withTimezone: true }),
	},
	(table) => [
		// One pending invitation per email and project. A new invitation to the
		// same email updates this row and does not add a second one.
		uniqueIndex("project_invitations_projectId_email_pending_uq")
			.on(table.projectId, table.email)
			.where(sql`${table.status} = 'pending'`),
		// The invitee's pending list and the invitations banner.
		index("project_invitations_email_status_idx").on(table.email, table.status),
	],
);

export const inviteLinks = pgTable(
	"invite_links",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// 32 random bytes, base64url (43 characters). Clear text, like the
		// Better Auth invitation id in a workspace invite URL.
		token: text("token").notNull(),
		// Exactly one of `organizationId` and `projectId` is set (check below).
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "cascade",
		}),
		projectId: uuid("project_id").references(() => projects.id, {
			onDelete: "cascade",
		}),
		// Workspace link: a `member.role` value, `member` or `viewer`.
		// Project link: a `project_member_role` value, `editor` or `viewer`.
		role: text("role").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Workspace links live 5 days, project links 7 days.
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		// Set when a manager revokes the link, or a new link replaces it.
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("invite_links_token_uq").on(table.token),
		check(
			"invite_links_one_target_ck",
			sql`num_nonnulls(${table.organizationId}, ${table.projectId}) = 1`,
		),
		// One active link per workspace role. A new link revokes the old one
		// in the same transaction, so this index never blocks a valid write.
		uniqueIndex("invite_links_org_role_active_uq")
			.on(table.organizationId, table.role)
			.where(
				sql`${table.revokedAt} IS NULL AND ${table.organizationId} IS NOT NULL`,
			),
		// One active link per project, with the same replace rule.
		uniqueIndex("invite_links_project_active_uq")
			.on(table.projectId)
			.where(
				sql`${table.revokedAt} IS NULL AND ${table.projectId} IS NOT NULL`,
			),
	],
);

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
	project: one(projects, {
		fields: [projectMembers.projectId],
		references: [projects.id],
	}),
	user: one(user, {
		fields: [projectMembers.userId],
		references: [user.id],
	}),
}));

export const projectInvitationsRelations = relations(
	projectInvitations,
	({ one }) => ({
		project: one(projects, {
			fields: [projectInvitations.projectId],
			references: [projects.id],
		}),
		inviter: one(user, {
			fields: [projectInvitations.inviterUserId],
			references: [user.id],
		}),
	}),
);

export const inviteLinksRelations = relations(inviteLinks, ({ one }) => ({
	organization: one(organization, {
		fields: [inviteLinks.organizationId],
		references: [organization.id],
	}),
	project: one(projects, {
		fields: [inviteLinks.projectId],
		references: [projects.id],
	}),
	createdBy: one(user, {
		fields: [inviteLinks.createdByUserId],
		references: [user.id],
	}),
}));
