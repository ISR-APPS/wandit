import { sql } from "drizzle-orm";
import {
	check,
	date,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const monthlyCosts = pgTable(
	"monthly_costs",
	{
		month: date("month").primaryKey(),
		currency: text("currency").notNull().default("usd"),
		adSpendBySourceCents: jsonb("ad_spend_by_source_cents")
			.$type<Record<string, number>>()
			.notNull()
			.default(sql`'{}'::jsonb`),
		infrastructureCostCents: integer("infrastructure_cost_cents")
			.notNull()
			.default(0),
		otherCostCents: integer("other_cost_cents").notNull().default(0),
		notes: text("notes"),
		version: integer("version").notNull().default(1),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		updatedByUserId: text("updated_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		check(
			"monthly_costs_month_first_day_ck",
			sql`extract(day from ${table.month}) = 1`,
		),
	],
);
