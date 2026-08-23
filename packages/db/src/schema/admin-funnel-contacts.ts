import {
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const adminFunnelContacts = pgTable(
	"admin_funnel_contacts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Outreach is tracked per person, not per funnel step.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		contactedByUserId: text("contacted_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		contactedAt: timestamp("contacted_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [uniqueIndex("admin_funnel_contacts_userId_uq").on(table.userId)],
);
