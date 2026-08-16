import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
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
import { organization } from "./organizations";

export const billingPlan = pgEnum("billing_plan", ["pro", "business"]);

export const billingInterval = pgEnum("billing_interval", ["month", "year"]);

export const billingWebhookStatus = pgEnum("billing_webhook_status", [
	"received",
	"processing",
	"processed",
	"failed",
	"skipped",
]);

export const subscriptionRefillSlotStatus = pgEnum(
	"subscription_refill_slot_status",
	["pending", "granted", "canceled"],
);

export const billingChangeIntentStatus = pgEnum(
	"billing_change_intent_status",
	["open", "processing", "consumed", "expired"],
);

export const billingCheckoutPurpose = pgEnum("billing_checkout_purpose", [
	"subscription",
	"topup",
]);

export const billingCheckoutAttemptStatus = pgEnum(
	"billing_checkout_attempt_status",
	["created", "session_attached", "completed", "expired"],
);

export const subscriptionStateEventKind = pgEnum(
	"subscription_state_event_kind",
	[
		"created",
		"plan_changed",
		"status_changed",
		"cancel_scheduled",
		"cancel_unscheduled",
		"ended",
	],
);

export const billingPaymentAdjustmentKind = pgEnum(
	"billing_payment_adjustment_kind",
	["refund", "failed_payment"],
);

export const signupGrantOutboxStatus = pgEnum("signup_grant_outbox_status", [
	"pending",
	"done",
	"skipped",
]);

export const betaAccessAction = pgEnum("beta_access_action", [
	"granted",
	"revoked",
]);

export const productSettings = pgTable(
	"product_settings",
	{
		id: integer("id").primaryKey().default(1),
		earlyAccessRequired: boolean("early_access_required")
			.notNull()
			.default(true),
		signupGrantEnabled: boolean("signup_grant_enabled")
			.notNull()
			.default(false),
		signupGrantCredits: integer("signup_grant_credits").notNull().default(50),
		paidSubscriptionsEnabled: boolean("paid_subscriptions_enabled")
			.notNull()
			.default(false),
		topupsEnabled: boolean("topups_enabled").notNull().default(false),
		// Teams/Workspaces kill switch: gates workspace creation and Business
		// checkout admission. Webhooks always honor paid org money regardless.
		organizationsEnabled: boolean("organizations_enabled")
			.notNull()
			.default(false),
		// Email auth kill switch: gates magic-link/OTP email SENDS (no send ⇒
		// no token ⇒ verify can never succeed; ≤10-min token tail after a
		// flip-off). Google sign-in is never affected.
		emailAuthEnabled: boolean("email_auth_enabled").notNull().default(false),
		version: integer("version").notNull().default(1),
		updatedByUserId: text("updated_by_user_id").references(() => user.id, {
			onDelete: "restrict",
		}),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		check("product_settings_singleton_id_ck", sql`${table.id} = 1`),
		check(
			"product_settings_signup_grant_credits_positive_ck",
			sql`${table.signupGrantCredits} > 0`,
		),
	],
);

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
			// For org subscriptions this mirrors the purchasing admin — provenance
			// only; NO money path reads it. Owner identity = organizationId ?? userId.
			.references(() => user.id, { onDelete: "restrict" }),
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		provider: text("provider").notNull(),
		providerSubscriptionId: text("provider_subscription_id").notNull(),
		plan: billingPlan("plan").notNull(),
		tierCredits: integer("tier_credits").notNull(),
		pendingTierCredits: integer("pending_tier_credits"),
		pendingAppliedBy: text("pending_applied_by"),
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
		index("subscriptions_createdAt_idx").on(table.createdAt),
		uniqueIndex("subscriptions_providerSubscriptionId_uq").on(
			table.providerSubscriptionId,
		),
		// One live PERSONAL subscription per user. Org subscriptions are exempt:
		// the same user may administer several org subscriptions.
		uniqueIndex("subscriptions_userId_nonTerminal_uq")
			.on(table.userId)
			.where(
				sql`${table.status} NOT IN ('canceled', 'incomplete_expired') AND ${table.organizationId} IS NULL`,
			),
		// One live subscription per organization.
		uniqueIndex("subscriptions_orgId_nonTerminal_uq")
			.on(table.organizationId)
			.where(
				sql`${table.status} NOT IN ('canceled', 'incomplete_expired') AND ${table.organizationId} IS NOT NULL`,
			),
	],
);

// Org Stripe customers live in their OWN table so the personal
// billing_customers invariants (one row per user, ON CONFLICT (user_id)
// upsert, findByUserId) stay byte-identical — relaxing them was reviewed and
// rejected as a personal-money-path outage (teams-workspaces.md §5.1).
export const organizationBillingCustomers = pgTable(
	"organization_billing_customers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "restrict" }),
		provider: text("provider").notNull(),
		providerCustomerId: text("provider_customer_id").notNull(),
		// Affiliate policy snapshot: the org's earliest owner-role member at
		// customer-creation time. Org invoices attribute to THIS user's affiliate
		// attribution — never the checkout actor.
		attributionUserId: text("attribution_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
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
		uniqueIndex("organization_billing_customers_orgId_uq").on(
			table.organizationId,
		),
		uniqueIndex("organization_billing_customers_provider_customerId_uq").on(
			table.provider,
			table.providerCustomerId,
		),
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
		deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
		processedAt: timestamp("processed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [index("billing_webhook_events_status_idx").on(table.status)],
);

export const subscriptionStateEvents = pgTable(
	"subscription_state_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		stripeEventId: text("stripe_event_id").notNull(),
		stripeSubscriptionId: text("stripe_subscription_id").notNull(),
		userId: text("user_id").references(() => user.id, {
			onDelete: "restrict",
		}),
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		kind: subscriptionStateEventKind("kind").notNull(),
		fromLookupKey: text("from_lookup_key"),
		toLookupKey: text("to_lookup_key"),
		fromStatus: text("from_status"),
		toStatus: text("to_status"),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("subscription_state_events_stripeEventId_uq").on(
			table.stripeEventId,
		),
		index("subscription_state_events_occurredAt_idx").on(table.occurredAt),
		index("subscription_state_events_stripeSubscriptionId_occurredAt_idx").on(
			table.stripeSubscriptionId,
			table.occurredAt,
		),
	],
);

export const billingPaymentAdjustments = pgTable(
	"billing_payment_adjustments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		stripeEventId: text("stripe_event_id").notNull(),
		kind: billingPaymentAdjustmentKind("kind").notNull(),
		stripeObjectId: text("stripe_object_id").notNull(),
		userId: text("user_id").references(() => user.id, {
			onDelete: "restrict",
		}),
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		amountCents: integer("amount_cents").notNull(),
		currency: text("currency").notNull(),
		cumulativeRefundedCents: integer("cumulative_refunded_cents"),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("billing_payment_adjustments_stripeEventId_uq").on(
			table.stripeEventId,
		),
		index("billing_payment_adjustments_occurredAt_idx").on(table.occurredAt),
		index("billing_payment_adjustments_kind_occurredAt_idx").on(
			table.kind,
			table.occurredAt,
		),
	],
);

export const billingCheckoutAttempts = pgTable(
	"billing_checkout_attempts",
	{
		id: uuid("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// NULL = personal checkout. Set = checkout on behalf of this org
		// (userId is then the acting billing manager).
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		purpose: billingCheckoutPurpose("purpose").notNull(),
		priceLookupKey: text("price_lookup_key"),
		packId: text("pack_id"),
		providerSessionId: text("provider_session_id"),
		status: billingCheckoutAttemptStatus("status").notNull().default("created"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("billing_checkout_attempts_providerSessionId_uq").on(
			table.providerSessionId,
		),
		index("billing_checkout_attempts_userId_purpose_status_idx").on(
			table.userId,
			table.purpose,
			table.status,
		),
	],
);

export const subscriptionRefillSlots = pgTable(
	"subscription_refill_slots",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		subscriptionId: uuid("subscription_id")
			.notNull()
			.references(() => subscriptions.id, { onDelete: "restrict" }),
		periodOrdinal: integer("period_ordinal").notNull(),
		dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
		credits: integer("credits").notNull(),
		fundingInvoiceId: text("funding_invoice_id").notNull(),
		fundingChargeId: text("funding_charge_id"),
		fundingPaymentIntentId: text("funding_payment_intent_id"),
		status: subscriptionRefillSlotStatus("status").notNull().default("pending"),
		grantedAt: timestamp("granted_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("subscription_refill_slots_subscription_invoice_ordinal_uq").on(
			table.subscriptionId,
			table.fundingInvoiceId,
			table.periodOrdinal,
		),
		index("subscription_refill_slots_status_dueAt_idx").on(
			table.status,
			table.dueAt,
		),
		check(
			"subscription_refill_slots_period_ordinal_ck",
			sql`${table.periodOrdinal} BETWEEN 2 AND 12`,
		),
		check(
			"subscription_refill_slots_credits_positive_ck",
			sql`${table.credits} > 0`,
		),
	],
);

export const billingInvoiceApplications = pgTable(
	"billing_invoice_applications",
	{
		stripeInvoiceId: text("stripe_invoice_id").notNull(),
		subscriptionId: uuid("subscription_id")
			.notNull()
			.references(() => subscriptions.id, { onDelete: "restrict" }),
		billingReason: text("billing_reason").notNull(),
		oldPriceLookupKey: text("old_price_lookup_key"),
		newPriceLookupKey: text("new_price_lookup_key").notNull(),
		periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
		periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
		creditsDelta: integer("credits_delta").notNull(),
		// Settlement snapshot for revenue reporting: what Stripe actually
		// collected for this invoice. Nullable — rows written before these
		// columns existed carry no snapshot.
		amountPaidMinor: integer("amount_paid_minor"),
		currency: text("currency"),
		paidAt: timestamp("paid_at", { withTimezone: true }),
		appliedAt: timestamp("applied_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("billing_invoice_applications_paidAt_idx").on(table.paidAt),
		uniqueIndex("billing_invoice_applications_stripeInvoiceId_uq").on(
			table.stripeInvoiceId,
		),
		index("billing_invoice_applications_subscriptionId_idx").on(
			table.subscriptionId,
		),
		index("billing_invoice_applications_cycle_periodEnd_idx")
			.on(table.subscriptionId, table.periodEnd)
			.where(sql`${table.billingReason} = 'subscription_cycle'`),
	],
);

export const billingChangeIntents = pgTable(
	"billing_change_intents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// NULL = change on a personal subscription. Set = change on this org's
		// subscription (userId is then the acting billing manager).
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		subscriptionId: uuid("subscription_id")
			.notNull()
			.references(() => subscriptions.id, { onDelete: "restrict" }),
		currentPriceLookupKey: text("current_price_lookup_key").notNull(),
		targetPriceLookupKey: text("target_price_lookup_key").notNull(),
		prorationDate: timestamp("proration_date", {
			withTimezone: true,
		}).notNull(),
		previewTotalMinor: integer("preview_total_minor").notNull(),
		currency: text("currency").notNull(),
		status: billingChangeIntentStatus("status").notNull().default("open"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		providerAttemptedAt: timestamp("provider_attempted_at", {
			withTimezone: true,
		}),
		providerOutcome: text("provider_outcome"),
		providerHostedInvoiceUrl: text("provider_hosted_invoice_url"),
		providerPendingExpiresAt: timestamp("provider_pending_expires_at", {
			withTimezone: true,
		}),
		consumedAt: timestamp("consumed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("billing_change_intents_userId_idx").on(table.userId),
		index("billing_change_intents_subscriptionId_idx").on(table.subscriptionId),
		index("billing_change_intents_status_expiresAt_idx").on(
			table.status,
			table.expiresAt,
		),
	],
);

export const signupGrantOutbox = pgTable(
	"signup_grant_outbox",
	{
		userId: text("user_id")
			.primaryKey()
			.references(() => user.id, { onDelete: "restrict" }),
		credits: integer("credits").notNull(),
		settingsVersion: integer("settings_version").notNull(),
		status: signupGrantOutboxStatus("status").notNull().default("pending"),
		attempts: integer("attempts").notNull().default(0),
		lastError: text("last_error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		doneAt: timestamp("done_at", { withTimezone: true }),
	},
	(table) => [
		check("signup_grant_outbox_credits_positive_ck", sql`${table.credits} > 0`),
		check(
			"signup_grant_outbox_attempts_nonnegative_ck",
			sql`${table.attempts} >= 0`,
		),
	],
);

export const betaAccessEvents = pgTable(
	"beta_access_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		action: betaAccessAction("action").notNull(),
		actorUserId: text("actor_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		reason: text("reason"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("beta_access_events_userId_createdAt_idx").on(
			table.userId,
			table.createdAt,
		),
		index("beta_access_events_actorUserId_idx").on(table.actorUserId),
	],
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

export const billingCheckoutAttemptsRelations = relations(
	billingCheckoutAttempts,
	({ one }) => ({
		user: one(user, {
			fields: [billingCheckoutAttempts.userId],
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
