import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userOnboarding = pgTable("user_onboarding", {
	// One row per user; answers die with the account (cascade), matching other
	// user-owned records like mcp_connections.
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	answers: jsonb("answers").$type<Record<string, string>>().notNull(),
	questionsVersion: text("questions_version").notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const userOnboardingRelations = relations(userOnboarding, ({ one }) => ({
	user: one(user, {
		fields: [userOnboarding.userId],
		references: [user.id],
	}),
}));
