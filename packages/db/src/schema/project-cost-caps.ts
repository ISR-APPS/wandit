/**
 * Per-project spend limits for V2 builder turns.
 * The V2 guard reads the row before it admits a turn.
 * The project owner writes it through project settings.
 */
import { relations, sql } from "drizzle-orm";
import {
	check,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { projects } from "./projects";

export const projectCostCaps = pgTable(
	"project_cost_caps",
	{
		// The row exists only for projects with custom caps, so the project id
		// is the primary key. Cascade: a deleted project loses its caps.
		projectId: uuid("project_id")
			.primaryKey()
			.references(() => projects.id, { onDelete: "cascade" }),
		// UNIT: centi-credits. Null means the plan default.
		monthlyCapCredits: integer("monthly_cap_credits"),
		// UNIT: centi-credits. Null means the plan default.
		perTurnCapCredits: integer("per_turn_cap_credits"),
		// The user that last changed the caps.
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
			"project_cost_caps_monthly_cap_nonnegative_ck",
			sql`${table.monthlyCapCredits} IS NULL OR ${table.monthlyCapCredits} >= 0`,
		),
		check(
			"project_cost_caps_per_turn_cap_nonnegative_ck",
			sql`${table.perTurnCapCredits} IS NULL OR ${table.perTurnCapCredits} >= 0`,
		),
	],
);

export const projectCostCapsRelations = relations(
	projectCostCaps,
	({ one }) => ({
		project: one(projects, {
			fields: [projectCostCaps.projectId],
			references: [projects.id],
		}),
		updatedByUser: one(user, {
			fields: [projectCostCaps.updatedByUserId],
			references: [user.id],
		}),
	}),
);
