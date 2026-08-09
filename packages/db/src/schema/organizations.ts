// Database schema for organizations (Teams/Workspaces v1).
//
// The `organization`, `member`, and `invitation` exports are consumed by the
// Better Auth drizzle adapter, which resolves models BY EXPORT NAME — renaming
// them breaks every /api/auth/organization/* route. Their columns mirror the
// plugin's runtime schema for better-auth 1.6.22
// (dist/plugins/organization/organization.mjs); keep in sync on upgrades.
import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const organization = pgTable(
	"organization",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		logo: text("logo"),
		// Better Auth serializes JSON into this text column itself — not jsonb.
		metadata: text("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("organization_slug_uq").on(table.slug),
		index("organization_createdAt_idx").on(table.createdAt),
	],
);

export const member = pgTable(
	"member",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			// restrict like every other user reference: user deletion is
			// soft/anonymize at the app layer, never a DB cascade.
			.references(() => user.id, { onDelete: "restrict" }),
		// Comma-separated multi-role string in better-auth 1.6.22 — never compare
		// with string equality; use the shared permission helpers.
		role: text("role").notNull().default("member"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// The plugin does find-then-create but declares no constraint; this is the
		// backstop. The invitation-accept path inserts WITHOUT a find, so a
		// double-invite race can trip it after the invitation is consumed — the
		// accept handler maps unique-violation to "already a member".
		uniqueIndex("member_organizationId_userId_uq").on(
			table.organizationId,
			table.userId,
		),
		index("member_userId_idx").on(table.userId),
		index("member_organizationId_idx").on(table.organizationId),
	],
);

export const invitation = pgTable(
	"invitation",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		// Nullable in the plugin's runtime schema (defaults to member on accept).
		role: text("role"),
		status: text("status").notNull().default("pending"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		inviterId: text("inviter_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("invitation_organizationId_status_idx").on(
			table.organizationId,
			table.status,
		),
		index("invitation_email_idx").on(table.email),
	],
);

// ---------------------------------------------------------------------------
// Application-owned org billing configuration (not Better Auth models).
// ---------------------------------------------------------------------------

// Per-org billing knobs. One row per org, created lazily on first write.
export const organizationBillingSettings = pgTable(
	"organization_billing_settings",
	{
		organizationId: text("organization_id")
			.primaryKey()
			.references(() => organization.id, { onDelete: "restrict" }),
		// NULL = unlimited. Applies to `member`-role members without an explicit
		// per-member row; owners/admins are exempt from the default.
		defaultMemberMonthlyCreditLimit: integer(
			"default_member_monthly_credit_limit",
		),
		updatedByUserId: text("updated_by_user_id").references(() => user.id, {
			onDelete: "restrict",
		}),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		check(
			"organization_billing_settings_default_limit_positive_ck",
			sql`${table.defaultMemberMonthlyCreditLimit} IS NULL OR ${table.defaultMemberMonthlyCreditLimit} > 0`,
		),
	],
);

// Explicit per-member limit override; binds regardless of role. Enforced at
// metering reserve time against calendar-month UTC spend (NOT the subscription
// period — yearly subscriptions have a 12-month Stripe period).
export const organizationMemberCreditLimits = pgTable(
	"organization_member_credit_limits",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "restrict" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		monthlyCreditLimit: integer("monthly_credit_limit").notNull(),
		updatedByUserId: text("updated_by_user_id").references(() => user.id, {
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
		uniqueIndex("organization_member_credit_limits_org_user_uq").on(
			table.organizationId,
			table.userId,
		),
		check(
			"organization_member_credit_limits_positive_ck",
			sql`${table.monthlyCreditLimit} > 0`,
		),
	],
);

export const organizationRelations = relations(organization, ({ many }) => ({
	members: many(member),
	invitations: many(invitation),
}));

export const memberRelations = relations(member, ({ one }) => ({
	organization: one(organization, {
		fields: [member.organizationId],
		references: [organization.id],
	}),
	user: one(user, {
		fields: [member.userId],
		references: [user.id],
	}),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
	organization: one(organization, {
		fields: [invitation.organizationId],
		references: [organization.id],
	}),
	inviter: one(user, {
		fields: [invitation.inviterId],
		references: [user.id],
	}),
}));
