import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const adminViewGrants = pgTable("admin_view_grants", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	// Phase-1 payload: array of view keys. Phase 2 will evolve this JSONB into a
	// view-to-actions map; keep the payload extensible rather than adding columns.
	views: jsonb("views").$type<string[]>().notNull(),
	updatedByUserId: text("updated_by_user_id").references(() => user.id, {
		onDelete: "set null",
	}),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});
