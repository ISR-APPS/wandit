import {
	date,
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userActivityDays = pgTable(
	"user_activity_days",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		activityDate: date("activity_date").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.activityDate] }),
		index("user_activity_days_activityDate_idx").on(table.activityDate),
	],
);
