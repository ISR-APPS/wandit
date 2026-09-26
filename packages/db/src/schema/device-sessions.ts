/**
 * One Appetize device session of the V2 mobile preview (WANDIT-196). The
 * device-session routes insert and end rows; the `device-minutes` task
 * bills them from the Appetize session times. The minute allowance of a
 * payer is the sum of its rows in the month.
 */
import { sql } from "drizzle-orm";
import {
	index,
	integer,
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

/** Platform of the Appetize device: it picks the Expo Go build. */
export const deviceSessionPlatform = pgEnum("device_session_platform", [
	"ios",
	"android",
]);

export const deviceSessions = pgTable(
	"device_sessions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Restrict, not cascade: minute history must survive account rows.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Set when the project belongs to an org workspace; the org pays then.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// Set null, not cascade: a deleted project must not give its minutes back.
		projectId: uuid("project_id").references(() => projects.id, {
			onDelete: "set null",
		}),
		platform: deviceSessionPlatform("platform").notNull(),
		// `session.token` of the Appetize JS SDK. Null until the browser reports it.
		appetizeSessionToken: text("appetize_session_token"),
		startedAt: timestamp("started_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		// Set by the end route, or by the minutes task for a session the browser left.
		endedAt: timestamp("ended_at", { withTimezone: true }),
		// Billed minutes, rounded up. Null until the minutes task bills the row.
		minutes: integer("minutes"),
		// Set once with `minutes`; a second bill of the row is a no-op.
		billedAt: timestamp("billed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		// One ledger row per Appetize session: a second report of a token fails.
		uniqueIndex("device_sessions_appetizeSessionToken_uq")
			.on(table.appetizeSessionToken)
			.where(sql`${table.appetizeSessionToken} IS NOT NULL`),
		// The minutes task scans the rows it has not billed yet.
		index("device_sessions_unbilled_startedAt_idx")
			.on(table.startedAt)
			.where(sql`${table.billedAt} IS NULL`),
		// The allowance sums the rows of one payer in one month.
		index("device_sessions_userId_startedAt_idx").on(
			table.userId,
			table.startedAt,
		),
		index("device_sessions_organizationId_startedAt_idx").on(
			table.organizationId,
			table.startedAt,
		),
	],
);
