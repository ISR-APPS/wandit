import { sql } from "drizzle-orm";
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

export const affiliateProgramKind = pgEnum("affiliate_program_kind", [
	"percentage_recurring",
	"fixed_one_time",
]);

export const affiliateProgramStatus = pgEnum("affiliate_program_status", [
	"active",
	"archived",
]);

export const affiliateStatus = pgEnum("affiliate_status", ["active", "paused"]);

export const affiliatePayoutMethod = pgEnum("affiliate_payout_method", [
	"manual",
	"paypal",
	"wise",
]);

export const affiliateAttributionSource = pgEnum(
	"affiliate_attribution_source",
	["signup_cookie", "signup_body", "manual"],
);

export const affiliateAttributionStatus = pgEnum(
	"affiliate_attribution_status",
	["active", "voided"],
);

export const affiliateInvoiceCandidateStatus = pgEnum(
	"affiliate_invoice_candidate_status",
	["pending_attribution", "processed", "ineligible"],
);

export const affiliateCommissionEntryType = pgEnum(
	"affiliate_commission_entry_type",
	["earning", "adjustment"],
);

export const affiliateCommissionStatus = pgEnum("affiliate_commission_status", [
	"pending",
	"approved",
	"paid",
	"reversed",
]);

export const affiliatePayoutStatus = pgEnum("affiliate_payout_status", [
	"draft",
	"processing",
	"paid",
	"failed",
]);

export const affiliatePrograms = pgTable(
	"affiliate_programs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		kind: affiliateProgramKind("kind").notNull(),
		commissionRateBps: integer("commission_rate_bps"),
		fixedAmountCents: integer("fixed_amount_cents"),
		fixedCurrency: text("fixed_currency"),
		commissionDurationMonths: integer("commission_duration_months"),
		holdDays: integer("hold_days").notNull().default(30),
		cookieWindowDays: integer("cookie_window_days").notNull().default(60),
		status: affiliateProgramStatus("status").notNull().default("active"),
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
			"affiliate_programs_commission_rate_bps_ck",
			sql`${table.commissionRateBps} BETWEEN 0 AND 10000`,
		),
		check(
			"affiliate_programs_fixed_amount_cents_ck",
			sql`${table.fixedAmountCents} > 0`,
		),
		check(
			"affiliate_programs_percentage_terms_ck",
			sql`${table.kind} <> 'percentage_recurring' OR ${table.commissionRateBps} IS NOT NULL`,
		),
		check(
			"affiliate_programs_fixed_terms_ck",
			sql`${table.kind} <> 'fixed_one_time' OR ${table.fixedAmountCents} IS NOT NULL`,
		),
	],
);

export const affiliates = pgTable(
	"affiliates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id").references(() => user.id, {
			onDelete: "restrict",
		}),
		name: text("name").notNull(),
		email: text("email").notNull(),
		company: text("company"),
		channel: text("channel"),
		country: text("country"),
		payoutMethod: affiliatePayoutMethod("payout_method")
			.notNull()
			.default("manual"),
		payoutDetails: jsonb("payout_details"),
		status: affiliateStatus("status").notNull().default("active"),
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("affiliates_userId_uq")
			.on(table.userId)
			.where(sql`${table.userId} IS NOT NULL`),
	],
);

export const affiliateLinks = pgTable(
	"affiliate_links",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		programId: uuid("program_id")
			.notNull()
			.references(() => affiliatePrograms.id, { onDelete: "restrict" }),
		affiliateId: uuid("affiliate_id")
			.notNull()
			.references(() => affiliates.id, { onDelete: "restrict" }),
		code: text("code").notNull(),
		label: text("label"),
		landingPath: text("landing_path").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		active: boolean("active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("affiliate_links_code_uq").on(table.code),
		index("affiliate_links_affiliateId_idx").on(table.affiliateId),
		index("affiliate_links_programId_idx").on(table.programId),
	],
);

export const affiliateClicks = pgTable(
	"affiliate_clicks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		linkId: uuid("link_id")
			.notNull()
			.references(() => affiliateLinks.id, { onDelete: "restrict" }),
		ipHash: text("ip_hash").notNull(),
		userAgent: text("user_agent"),
		landingUrl: text("landing_url").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("affiliate_clicks_linkId_createdAt_idx").on(
			table.linkId,
			table.createdAt,
		),
		index("affiliate_clicks_createdAt_idx").on(table.createdAt),
	],
);

export const affiliateAttributions = pgTable(
	"affiliate_attributions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		linkId: uuid("link_id")
			.notNull()
			.references(() => affiliateLinks.id, { onDelete: "restrict" }),
		affiliateId: uuid("affiliate_id")
			.notNull()
			.references(() => affiliates.id, { onDelete: "restrict" }),
		programId: uuid("program_id")
			.notNull()
			.references(() => affiliatePrograms.id, { onDelete: "restrict" }),
		programKind: affiliateProgramKind("program_kind").notNull(),
		commissionRateBps: integer("commission_rate_bps"),
		fixedAmountCents: integer("fixed_amount_cents"),
		fixedCurrency: text("fixed_currency"),
		commissionDurationMonths: integer("commission_duration_months"),
		clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull(),
		lockedAt: timestamp("locked_at", { withTimezone: true }).notNull(),
		source: affiliateAttributionSource("source").notNull(),
		status: affiliateAttributionStatus("status").notNull().default("active"),
		fraudFlags: jsonb("fraud_flags").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("affiliate_attributions_userId_uq").on(table.userId),
		index("affiliate_attributions_linkId_idx").on(table.linkId),
		index("affiliate_attributions_affiliateId_idx").on(table.affiliateId),
		index("affiliate_attributions_programId_idx").on(table.programId),
		check(
			"affiliate_attributions_commission_rate_bps_ck",
			sql`${table.commissionRateBps} BETWEEN 0 AND 10000`,
		),
		check(
			"affiliate_attributions_fixed_amount_cents_ck",
			sql`${table.fixedAmountCents} > 0`,
		),
		check(
			"affiliate_attributions_percentage_terms_ck",
			sql`${table.programKind} <> 'percentage_recurring' OR ${table.commissionRateBps} IS NOT NULL`,
		),
		check(
			"affiliate_attributions_fixed_terms_ck",
			sql`${table.programKind} <> 'fixed_one_time' OR ${table.fixedAmountCents} IS NOT NULL`,
		),
	],
);

export const affiliateInvoiceCandidates = pgTable(
	"affiliate_invoice_candidates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		stripeInvoiceId: text("stripe_invoice_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		billingReason: text("billing_reason").notNull(),
		baseAmountCents: integer("base_amount_cents").notNull(),
		currency: text("currency").notNull(),
		paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
		status: affiliateInvoiceCandidateStatus("status")
			.notNull()
			.default("pending_attribution"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("affiliate_invoice_candidates_stripeInvoiceId_uq").on(
			table.stripeInvoiceId,
		),
		index("affiliate_invoice_candidates_userId_idx").on(table.userId),
		check(
			"affiliate_invoice_candidates_base_amount_cents_ck",
			sql`${table.baseAmountCents} >= 0`,
		),
	],
);

export const affiliatePayouts = pgTable(
	"affiliate_payouts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		affiliateId: uuid("affiliate_id")
			.notNull()
			.references(() => affiliates.id, { onDelete: "restrict" }),
		totalCents: integer("total_cents").notNull(),
		currency: text("currency").notNull(),
		method: affiliatePayoutMethod("method").notNull(),
		externalRef: text("external_ref"),
		requestId: uuid("request_id").notNull(),
		status: affiliatePayoutStatus("status").notNull().default("draft"),
		periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
		periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
		paidAt: timestamp("paid_at", { withTimezone: true }),
		createdByUserId: text("created_by_user_id")
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
		uniqueIndex("affiliate_payouts_requestId_uq").on(table.requestId),
		uniqueIndex("affiliate_payouts_method_externalRef_uq")
			.on(table.method, table.externalRef)
			.where(sql`${table.externalRef} IS NOT NULL`),
		index("affiliate_payouts_affiliateId_idx").on(table.affiliateId),
		index("affiliate_payouts_createdByUserId_idx").on(table.createdByUserId),
		check("affiliate_payouts_total_cents_ck", sql`${table.totalCents} > 0`),
	],
);

export const affiliateCommissions = pgTable(
	"affiliate_commissions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		attributionId: uuid("attribution_id")
			.notNull()
			.references(() => affiliateAttributions.id, { onDelete: "restrict" }),
		affiliateId: uuid("affiliate_id")
			.notNull()
			.references(() => affiliates.id, { onDelete: "restrict" }),
		entryType: affiliateCommissionEntryType("entry_type").notNull(),
		originalCommissionId: uuid("original_commission_id").references(
			(): AnyPgColumn => affiliateCommissions.id,
			{ onDelete: "restrict" },
		),
		stripeInvoiceId: text("stripe_invoice_id").notNull(),
		stripeRefundId: text("stripe_refund_id"),
		stripeDisputeId: text("stripe_dispute_id"),
		stripeChargeId: text("stripe_charge_id").notNull(),
		currency: text("currency").notNull(),
		baseAmountCents: integer("base_amount_cents").notNull(),
		rateBps: integer("rate_bps"),
		amountCents: integer("amount_cents").notNull(),
		status: affiliateCommissionStatus("status").notNull().default("pending"),
		holdUntil: timestamp("hold_until", { withTimezone: true }).notNull(),
		payoutId: uuid("payout_id").references(() => affiliatePayouts.id, {
			onDelete: "restrict",
		}),
		reversalReason: text("reversal_reason"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("affiliate_commissions_earning_stripeInvoiceId_uq")
			.on(table.stripeInvoiceId)
			.where(sql`${table.entryType} = 'earning'`),
		uniqueIndex("affiliate_commissions_stripeRefundId_uq").on(
			table.stripeRefundId,
		),
		uniqueIndex("affiliate_commissions_stripeDisputeId_uq").on(
			table.stripeDisputeId,
		),
		index("affiliate_commissions_affiliateId_status_idx").on(
			table.affiliateId,
			table.status,
		),
		index("affiliate_commissions_status_holdUntil_idx").on(
			table.status,
			table.holdUntil,
		),
		index("affiliate_commissions_attributionId_idx").on(table.attributionId),
		index("affiliate_commissions_originalCommissionId_idx").on(
			table.originalCommissionId,
		),
		index("affiliate_commissions_payoutId_idx").on(table.payoutId),
		check(
			"affiliate_commissions_rate_bps_ck",
			sql`${table.rateBps} BETWEEN 0 AND 10000`,
		),
		check(
			"affiliate_commissions_base_amount_cents_ck",
			sql`${table.baseAmountCents} >= 0`,
		),
		check(
			"affiliate_commissions_earning_amount_cents_ck",
			sql`${table.entryType} = 'adjustment' OR ${table.amountCents} > 0`,
		),
		check(
			"affiliate_commissions_adjustment_original_ck",
			sql`${table.entryType} <> 'adjustment' OR ${table.originalCommissionId} IS NOT NULL`,
		),
	],
);
