import { relations, sql } from "drizzle-orm";
import {
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

export const creditBucket = pgEnum("credit_bucket", ["plan", "topup"]);

// Append-only: rows are never updated or deleted. Balance = sum(delta).
export const creditLedger = pgTable(
	"credit_ledger",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			// restrict, not cascade: financial history must survive account rows —
			// user deletion is soft/anonymize at the app layer, never a DB cascade.
			.references(() => user.id, { onDelete: "restrict" }),
		// Reserved for Business org credits; no FK until org mechanics land.
		organizationId: text("organization_id"),
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
		uniqueIndex("credit_ledger_idempotencyKey_uq")
			.on(table.idempotencyKey)
			.where(sql`${table.idempotencyKey} IS NOT NULL`),
		check(
			"credit_ledger_delta_sign_chk",
			sql`(${table.kind} IN ('grant', 'topup') AND ${table.delta} > 0) OR (${table.kind} IN ('consume', 'expire', 'revoke') AND ${table.delta} < 0)`,
		),
	],
);

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
	user: one(user, {
		fields: [creditLedger.userId],
		references: [user.id],
	}),
}));
