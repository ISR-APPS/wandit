import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const billingPlan = pgEnum("billing_plan", ["pro", "business"]);

export const billingInterval = pgEnum("billing_interval", ["month", "year"]);

export const billingWebhookStatus = pgEnum("billing_webhook_status", [
	"received",
	"processing",
	"processed",
	"failed",
	"skipped",
]);

export const billingCustomers = pgTable(
	"billing_customers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		provider: text("provider").notNull(),
		providerCustomerId: text("provider_customer_id").notNull(),
		openCheckoutSessionId: text("open_checkout_session_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("billing_customers_userId_uq").on(table.userId),
		uniqueIndex("billing_customers_provider_customerId_uq").on(
			table.provider,
			table.providerCustomerId,
		),
	],
);

export const subscriptions = pgTable(
	"subscriptions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		organizationId: text("organization_id"),
		provider: text("provider").notNull(),
		providerSubscriptionId: text("provider_subscription_id").notNull(),
		plan: billingPlan("plan").notNull(),
		tierCredits: integer("tier_credits").notNull(),
		interval: billingInterval("interval").notNull(),
		status: text("status").notNull(),
		priceLookupKey: text("price_lookup_key").notNull(),
		currentPeriodStart: timestamp("current_period_start", {
			withTimezone: true,
		}).notNull(),
		currentPeriodEnd: timestamp("current_period_end", {
			withTimezone: true,
		}).notNull(),
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("subscriptions_providerSubscriptionId_uq").on(
			table.providerSubscriptionId,
		),
		uniqueIndex("subscriptions_userId_nonTerminal_uq")
			.on(table.userId)
			.where(sql`${table.status} NOT IN ('canceled', 'incomplete_expired')`),
	],
);

export const billingWebhookEvents = pgTable(
	"billing_webhook_events",
	{
		id: text("id").primaryKey(),
		provider: text("provider").notNull(),
		type: text("type").notNull(),
		payload: jsonb("payload").notNull(),
		status: billingWebhookStatus("status").notNull(),
		attemptCount: integer("attempt_count").notNull().default(0),
		claimedAt: timestamp("claimed_at", { withTimezone: true }),
		eventCreatedAt: timestamp("event_created_at", { withTimezone: true }),
		error: text("error"),
		processedAt: timestamp("processed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [index("billing_webhook_events_status_idx").on(table.status)],
);

export const billingCustomersRelations = relations(
	billingCustomers,
	({ one }) => ({
		user: one(user, {
			fields: [billingCustomers.userId],
			references: [user.id],
		}),
	}),
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
	user: one(user, {
		fields: [subscriptions.userId],
		references: [user.id],
	}),
}));
