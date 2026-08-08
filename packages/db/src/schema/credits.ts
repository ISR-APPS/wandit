import { relations, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
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

// Payment-provider-agnostic by design: Stripe, CIB, admin grants — every
// writer just inserts rows. Refunds are compensating `grant` rows meta-linked
// to the consume they reverse; money reversals (Stripe refund/dispute, CIB
// reversal) claw purchased credits back with `revoke` rows meta-linked to the
// topup they reverse.
export const creditKind = pgEnum("credit_kind", [
	"grant",
	"consume",
	"topup",
	"expire",
	"revoke",
]);

export const creditBucket = pgEnum("credit_bucket", ["plan", "promo", "topup"]);

export const aiUsageOperation = pgEnum("ai_usage_operation", [
	"chat",
	"page_build",
	"image",
	"video",
	"marketing",
	"connector",
	"lead_scrape",
	"transcription",
	"topup_adjust",
]);

export const aiUsageStatus = pgEnum("ai_usage_status", [
	"reserved",
	"settled",
	"reconciled",
	"refunded",
	"reconcile_failed",
]);

// Append-only: rows are never updated or deleted. Balance = sum(delta).
export const creditLedger = pgTable(
	"credit_ledger",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Owner semantics (teams-workspaces.md §3.2):
		//   personal row — userId set, organizationId NULL (every pre-org row).
		//   org row      — organizationId set; userId = acting member on
		//                  consumption rows (provenance), NULL on grants/refills/
		//                  topups/revokes that originate from invoices.
		userId: text("user_id")
			// restrict, not cascade: financial history must survive account rows —
			// user deletion is soft/anonymize at the app layer, never a DB cascade.
			.references(() => user.id, { onDelete: "restrict" }),
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		bucket: creditBucket("bucket").notNull().default("plan"),
		// Signed: grant/topup positive, consume/expire/revoke negative.
		// UNIT: whole credits — 1 is the minimum billable amount, forever
		// (rescaling to fractional units later would rewrite every row).
		delta: integer("delta").notNull(),
		kind: creditKind("kind").notNull(),
		// Dedupe for retryable writers (worker jobs, payment webhooks):
		// e.g. `consume:{jobId}`, `stripe:{eventId}`. Unique when present.
		idempotencyKey: text("idempotency_key"),
		// reason, jobId, refundOf, provider reference…
		meta: jsonb("meta"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// Serves both the balance sum and the ledger-history endpoint.
		index("credit_ledger_userId_createdAt_idx").on(
			table.userId,
			table.createdAt,
		),
		index("credit_ledger_userId_bucket_idx").on(table.userId, table.bucket),
		index("credit_ledger_paymentIntentId_idx").on(
			sql`(${table.meta} ->> 'paymentIntentId')`,
		),
		index("credit_ledger_chargeId_idx").on(sql`(${table.meta} ->> 'chargeId')`),
		uniqueIndex("credit_ledger_idempotencyKey_uq")
			.on(table.idempotencyKey)
			.where(sql`${table.idempotencyKey} IS NOT NULL`),
		// Org pool balance + history.
		index("credit_ledger_orgId_createdAt_idx")
			.on(table.organizationId, table.createdAt)
			.where(sql`${table.organizationId} IS NOT NULL`),
		index("credit_ledger_orgId_bucket_idx")
			.on(table.organizationId, table.bucket)
			.where(sql`${table.organizationId} IS NOT NULL`),
		check(
			"credit_ledger_delta_sign_chk",
			sql`(${table.kind} IN ('grant', 'topup') AND ${table.delta} > 0) OR (${table.kind} IN ('consume', 'expire', 'revoke') AND ${table.delta} < 0)`,
		),
		check(
			"credit_ledger_owner_present_ck",
			sql`${table.userId} IS NOT NULL OR ${table.organizationId} IS NOT NULL`,
		),
	],
);

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
	user: one(user, {
		fields: [creditLedger.userId],
		references: [user.id],
	}),
}));

/**
 * A refill can happen while several metering reservations still hold plan
 * credits. The pool is the shared carry allowance retained for those holds at
 * one rollover boundary. Keeping the allowance shared avoids assigning the
 * carry cap to an arbitrary operation before any operation's final cost is
 * known.
 */
export const creditPlanHoldPools = pgTable(
	"credit_plan_hold_pools",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Pool owner: personal → userId set / org NULL; org → organizationId set /
		// userId NULL. Same owner semantics as credit_ledger.
		userId: text("user_id").references(() => user.id, { onDelete: "restrict" }),
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		boundaryIdempotencyKey: text("boundary_idempotency_key").notNull(),
		remainingCredits: integer("remaining_credits").notNull(),
		closedAt: timestamp("closed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("credit_plan_hold_pools_boundary_key_uq").on(
			table.boundaryIdempotencyKey,
		),
		index("credit_plan_hold_pools_userId_idx").on(table.userId),
		index("credit_plan_hold_pools_orgId_idx")
			.on(table.organizationId)
			.where(sql`${table.organizationId} IS NOT NULL`),
		check(
			"credit_plan_hold_pools_remaining_nonnegative_ck",
			sql`${table.remainingCredits} >= 0`,
		),
		check(
			"credit_plan_hold_pools_owner_present_ck",
			sql`${table.userId} IS NOT NULL OR ${table.organizationId} IS NOT NULL`,
		),
	],
);

/**
 * Durable refundable plan entitlement for an idempotent metering consume.
 * `active` means the provider operation is still reserved, so its remaining
 * entitlement participates in the next rollover snapshot. Once settlement
 * makes the consumption real, the right remains available for a same-cycle
 * reconciliation correction but no longer counts as unused rollover credit.
 */
export const creditPlanHolds = pgTable(
	"credit_plan_holds",
	{
		consumeIdempotencyKey: text("consume_idempotency_key").primaryKey(),
		consumeLedgerId: uuid("consume_ledger_id")
			.notNull()
			.references(() => creditLedger.id, { onDelete: "restrict" }),
		// Hold owner: same personal/org semantics as credit_ledger.
		userId: text("user_id").references(() => user.id, { onDelete: "restrict" }),
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		poolId: uuid("pool_id").references(() => creditPlanHoldPools.id, {
			onDelete: "restrict",
		}),
		originalCredits: integer("original_credits").notNull(),
		refundableCredits: integer("refundable_credits").notNull(),
		active: boolean("active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("credit_plan_holds_consumeLedgerId_uq").on(
			table.consumeLedgerId,
		),
		index("credit_plan_holds_userId_active_idx").on(table.userId, table.active),
		index("credit_plan_holds_orgId_active_idx")
			.on(table.organizationId, table.active)
			.where(sql`${table.organizationId} IS NOT NULL`),
		check(
			"credit_plan_holds_owner_present_ck",
			sql`${table.userId} IS NOT NULL OR ${table.organizationId} IS NOT NULL`,
		),
		check(
			"credit_plan_holds_original_positive_ck",
			sql`${table.originalCredits} > 0`,
		),
		check(
			"credit_plan_holds_refundable_range_ck",
			sql`${table.refundableCredits} >= 0 AND ${table.refundableCredits} <= ${table.originalCredits}`,
		),
	],
);

export const creditPlanHoldPoolsRelations = relations(
	creditPlanHoldPools,
	({ one, many }) => ({
		user: one(user, {
			fields: [creditPlanHoldPools.userId],
			references: [user.id],
		}),
		holds: many(creditPlanHolds),
	}),
);

export const creditPlanHoldsRelations = relations(
	creditPlanHolds,
	({ one }) => ({
		consumeLedger: one(creditLedger, {
			fields: [creditPlanHolds.consumeLedgerId],
			references: [creditLedger.id],
		}),
		pool: one(creditPlanHoldPools, {
			fields: [creditPlanHolds.poolId],
			references: [creditPlanHoldPools.id],
		}),
		user: one(user, {
			fields: [creditPlanHolds.userId],
			references: [user.id],
		}),
	}),
);

export const aiUsageEvents = pgTable(
	"ai_usage_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// ALWAYS the acting member — actor attribution is never lost. The payer
		// pool is organizationId ?? userId (teams-workspaces.md §4.1).
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Set when the work was done in an org workspace: the org pool pays.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		operation: aiUsageOperation("operation").notNull(),
		parentEventId: uuid("parent_event_id").references(
			(): AnyPgColumn => aiUsageEvents.id,
			{ onDelete: "restrict" },
		),
		status: aiUsageStatus("status").notNull().default("reserved"),
		model: text("model"),
		provider: text("provider"),
		reservedCredits: integer("reserved_credits").notNull(),
		finalCredits: integer("final_credits"),
		estimatedCostUsdMicros: integer("estimated_cost_usd_micros"),
		reconciledCostUsdMicros: integer("reconciled_cost_usd_micros"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		cacheReadTokens: integer("cache_read_tokens"),
		cacheWriteTokens: integer("cache_write_tokens"),
		rawUsage: jsonb("raw_usage"),
		pricingSnapshot: jsonb("pricing_snapshot"),
		chatId: uuid("chat_id"),
		messageId: text("message_id"),
		attemptRef: text("attempt_ref"),
		idempotencyKey: text("idempotency_key").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		settledAt: timestamp("settled_at", { withTimezone: true }),
		reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
	},
	(table) => [
		index("ai_usage_events_userId_createdAt_idx").on(
			table.userId,
			table.createdAt,
		),
		// Per-member spend aggregation inside an org (calendar-month limits).
		index("ai_usage_events_orgId_userId_createdAt_idx")
			.on(table.organizationId, table.userId, table.createdAt)
			.where(sql`${table.organizationId} IS NOT NULL`),
		index("ai_usage_events_reserved_status_idx")
			.on(table.status)
			.where(sql`${table.status} = 'reserved'`),
		uniqueIndex("ai_usage_events_idempotencyKey_uq").on(table.idempotencyKey),
	],
);

export const aiUsageGenerationRefs = pgTable(
	"ai_usage_generation_refs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		usageEventId: uuid("usage_event_id")
			.notNull()
			.references(() => aiUsageEvents.id, { onDelete: "restrict" }),
		gatewayGenerationId: text("gateway_generation_id").notNull(),
		// Which provider produced this generation: "vercel" (AI Gateway) or
		// "openrouter". Reconciliation routes its cost lookup on this value.
		providerSource: text("provider_source").notNull().default("vercel"),
		stepUsage: jsonb("step_usage"),
		reconciledCostUsdMicros: integer("reconciled_cost_usd_micros"),
		reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
	},
	(table) => [
		index("ai_usage_generation_refs_usageEventId_idx").on(table.usageEventId),
		uniqueIndex("ai_usage_generation_refs_gatewayGenerationId_uq").on(
			table.gatewayGenerationId,
		),
	],
);

export const modelPrices = pgTable(
	"model_prices",
	{
		modelId: text("model_id").notNull(),
		provider: text("provider").notNull(),
		modelType: text("model_type").notNull(),
		inputUsdMicrosPerMTok: integer("input_usd_micros_per_mtok"),
		outputUsdMicrosPerMTok: integer("output_usd_micros_per_mtok"),
		cacheReadUsdMicrosPerMTok: integer("cache_read_usd_micros_per_mtok"),
		cacheWriteUsdMicrosPerMTok: integer("cache_write_usd_micros_per_mtok"),
		imageUsdMicros: integer("image_usd_micros"),
		raw: jsonb("raw").notNull(),
		refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull(),
	},
	(table) => [uniqueIndex("model_prices_modelId_uq").on(table.modelId)],
);

export const aiUsageEventsRelations = relations(
	aiUsageEvents,
	({ one, many }) => ({
		user: one(user, {
			fields: [aiUsageEvents.userId],
			references: [user.id],
		}),
		parentEvent: one(aiUsageEvents, {
			fields: [aiUsageEvents.parentEventId],
			references: [aiUsageEvents.id],
			relationName: "aiUsageEventChildren",
		}),
		childEvents: many(aiUsageEvents, {
			relationName: "aiUsageEventChildren",
		}),
		generationRefs: many(aiUsageGenerationRefs),
	}),
);

export const aiUsageGenerationRefsRelations = relations(
	aiUsageGenerationRefs,
	({ one }) => ({
		usageEvent: one(aiUsageEvents, {
			fields: [aiUsageGenerationRefs.usageEventId],
			references: [aiUsageEvents.id],
		}),
	}),
);
