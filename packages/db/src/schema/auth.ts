import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable(
	"user",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email").notNull().unique(),
		emailVerified: boolean("email_verified").default(false).notNull(),
		image: text("image"),
		// Better Auth admin plugin fields (role/banned/banReason/banExpires) —
		// property names must match the plugin's schema so the drizzle adapter
		// maps them.
		role: text("role").default("user").notNull(),
		// Server-owned Better Auth additional field. The auth config exposes it
		// on session users but rejects it from signup/update input.
		earlyAccess: boolean("early_access").default(false).notNull(),
		banned: boolean("banned").default(false).notNull(),
		banReason: text("ban_reason"),
		banExpires: timestamp("ban_expires", { withTimezone: true }),
		// Durable activity stamp for the admin dashboard. Sessions are deleted on
		// sign-out and by the ban sweep, so this cannot be derived from them; the
		// AuthGuard refreshes it (throttled) on authenticated requests.
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		// Serves admin signup stats and newest/oldest user listings.
		index("user_createdAt_idx").on(table.createdAt),
	],
);

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// Better Auth admin plugin: id of the admin impersonating this session.
		impersonatedBy: text("impersonated_by"),
		// Better Auth organization plugin writes this on org create/setActive.
		// The API NEVER reads it for scoping — workspace scope comes exclusively
		// from the x-wandit-workspace request header (docs/features/teams-workspaces.md §2).
		activeOrganizationId: text("active_organization_id"),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("account_userId_idx").on(table.userId),
		// One row per external identity — Better Auth looks accounts up by
		// (providerId, accountId); a concurrent sign-in must not duplicate it.
		uniqueIndex("account_providerId_accountId_uq").on(
			table.providerId,
			table.accountId,
		),
	],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Better Auth rate limiter storage (rateLimit.storage: "database"). One row
// per limiter key (IP+path bucket); Better Auth reads/creates/updates it via
// the drizzle adapter — the model name "rateLimit" resolves to this export by
// name — and deletes expired rows opportunistically. Durable across restarts
// and instances, unlike the default in-memory store.
export const rateLimit = pgTable(
	"rate_limit",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		count: integer("count").notNull(),
		// Milliseconds since epoch; Better Auth compares numerically.
		lastRequest: bigint("last_request", { mode: "number" }).notNull(),
	},
	(table) => [
		// consume() races INSERTs for a fresh key and relies on the duplicate
		// failing so the loser re-reads — this unique index is load-bearing.
		uniqueIndex("rate_limit_key_uq").on(table.key),
	],
);

// Audit trail + per-recipient caps for auth email sends (magic link, OTP).
// Better Auth's limiter above is IP-keyed; this table is what lets the server
// cap sends per EMAIL across IPs (burner farming / inbox-bombing protection).
export const authEmailSends = pgTable(
	"auth_email_sends",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		emailCanonical: text("email_canonical").notNull(),
		// Keyed HMAC of the client IP — correlation without raw PII at rest.
		ipHash: text("ip_hash"),
		kind: text("kind").notNull(),
		// Who caused the send, when that is someone other than the recipient:
		// the inviter's user id on invitation mail. Null for sign-in sends,
		// where the recipient IS the actor. No FK — these rows are throwaway
		// abuse-accounting and must not block user deletion.
		actorId: text("actor_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("auth_email_sends_email_createdAt_idx").on(
			table.emailCanonical,
			table.createdAt,
		),
		index("auth_email_sends_ipHash_createdAt_idx").on(
			table.ipHash,
			table.createdAt,
		),
		index("auth_email_sends_actorId_createdAt_idx").on(
			table.actorId,
			table.createdAt,
		),
	],
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));
