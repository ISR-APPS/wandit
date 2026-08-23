import { z } from "zod";
import {
	paginatedResultSchema,
	paginationQuerySchema,
} from "../http/pagination";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Credits contracts (docs/features/credits.md + docs/features/billing.md).
// The ledger is append-only and payment-provider-agnostic; balance =
// sum(delta). Every operation bills measured provider cost; the UI shows no
// per-action prices, so no display-price map lives here.

// Mirrors credit_kind in packages/db/src/schema/credits.ts. Signed deltas:
// grant/topup positive, consume/expire/revoke negative.
export const creditKinds = [
	"grant",
	"consume",
	"topup",
	"expire",
	"revoke",
] as const;

export const creditKindSchema = z.enum(creditKinds);

export type CreditKind = z.infer<typeof creditKindSchema>;

export const CREDIT_SPEND_ORDER = ["plan", "promo", "topup"] as const;

export const creditBuckets = CREDIT_SPEND_ORDER;

export const creditBucketSchema = z.enum(CREDIT_SPEND_ORDER);

export type CreditBucket = z.infer<typeof creditBucketSchema>;

export const PURCHASED_CREDIT_BUCKETS = [
	"plan",
	"topup",
] as const satisfies ReadonlyArray<CreditBucket>;

// Pricing v4: the DB and server domain count integer CENTI-CREDITS (1 credit
// = 100 cc); the API carries decimal credits with 2-dp semantics. These two
// helpers are the ONLY sanctioned conversions — responses divide once at the
// presentation boundary, credit inputs multiply once at the accept boundary.
export const CENTI_CREDITS_PER_CREDIT = 100;

/** Internal integer centi-credits -> decimal display credits (exact, 2 dp). */
export function centiCreditsToCredits(centiCredits: number): number {
	return centiCredits / CENTI_CREDITS_PER_CREDIT;
}

/** Decimal credit input -> integer centi-credits (rounds float dust away). */
export function creditsToCentiCredits(credits: number): number {
	return Math.round(credits * CENTI_CREDITS_PER_CREDIT);
}

// Decimal credits (server converts internal centi-credits at the boundary).
export const creditBalanceResponseSchema = z.object({
	plan: z.number(),
	promo: z.number(),
	topup: z.number(),
	balance: z.number(),
	// `balance` plus the in-flight reserve holds added back: what the balance
	// will read once running generations settle at estimated-or-lower cost.
	settledBalance: z.number(),
	// Each bucket plus the in-flight holds taken from that bucket.
	// UI surfaces display ONLY the settled* fields so holds never bounce
	// the pill or the bucket rows. The raw fields stay for admin/audit.
	settledPlan: z.number(),
	settledPromo: z.number(),
	settledTopup: z.number(),
});

export type CreditBalanceResponse = z.infer<typeof creditBalanceResponseSchema>;

// One row per workspace the user belongs to (personal first, then orgs).
// Balances are decimal credits; settledBalance follows the same add-back rule
// as creditBalanceResponseSchema.
export const workspaceCreditBalanceSchema = z.object({
	// PERSONAL_WORKSPACE ("personal") or an organization id.
	workspaceId: z.string(),
	// Organization name; null for the personal workspace (client labels it).
	name: z.string().nullable(),
	balance: z.number(),
	settledBalance: z.number(),
});

export type WorkspaceCreditBalance = z.infer<
	typeof workspaceCreditBalanceSchema
>;

export const workspaceCreditBalancesResponseSchema = z.object({
	items: z.array(workspaceCreditBalanceSchema),
});

export type WorkspaceCreditBalancesResponse = z.infer<
	typeof workspaceCreditBalancesResponseSchema
>;

export const creditLedgerRowSchema = z.object({
	id: uuidSchema,
	organizationId: z.string().nullable(),
	// Decimal credits; consumption deltas can be fractional (e.g. -0.37).
	delta: z.number(),
	kind: creditKindSchema,
	bucket: creditBucketSchema,
	meta: z.record(z.string(), z.unknown()).nullable(),
	createdAt: isoDateTimeSchema,
});

export type CreditLedgerRow = z.infer<typeof creditLedgerRowSchema>;

export const creditLedgerQuerySchema = paginationQuerySchema;

export type CreditLedgerQuery = z.infer<typeof creditLedgerQuerySchema>;

export const creditLedgerResponseSchema = paginatedResultSchema(
	creditLedgerRowSchema,
);

export type CreditLedgerResponse = z.infer<typeof creditLedgerResponseSchema>;

// User-facing activity: ONE row per top-level usage event (or per non-usage
// ledger row such as a grant/topup). Reserve, settle-refund, reconcile and
// refund ledger rows are never exposed here; the ledger route keeps them.
export const creditActivityStatuses = [
	"in_progress",
	"settled",
	"refunded",
] as const;

export const creditActivityStatusSchema = z.enum(creditActivityStatuses);

export type CreditActivityStatus = z.infer<typeof creditActivityStatusSchema>;

// Mirrors ai_usage_operation in packages/db/src/schema/credits.ts.
export const creditActivityOperations = [
	"chat",
	"page_build",
	"image",
	"video",
	"marketing",
	"connector",
	"lead_scrape",
	"transcription",
	"topup_adjust",
] as const;

export const creditActivityOperationSchema = z.enum(creditActivityOperations);

export type CreditActivityOperation = z.infer<
	typeof creditActivityOperationSchema
>;

export const creditActivityItemSchema = z.object({
	id: uuidSchema,
	// "usage": ai_usage_events row; "ledger": grant/topup/expire/revoke row.
	kind: z.enum(["usage", "ledger"]),
	// Set for kind "usage"; null for kind "ledger".
	operation: creditActivityOperationSchema.nullable(),
	status: creditActivityStatusSchema,
	// Net decimal credits: negative for spend, positive for grants/topups;
	// null while in_progress (no estimate is ever shown).
	credits: z.number().nullable(),
	// Set for kind "ledger"; null for kind "usage".
	ledgerKind: creditKindSchema.nullable(),
	bucket: creditBucketSchema.nullable(),
	reason: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	// Settle/refund time for usage rows; null while in_progress and for
	// ledger rows.
	finalizedAt: isoDateTimeSchema.nullable(),
});

export type CreditActivityItem = z.infer<typeof creditActivityItemSchema>;

export const creditActivityQuerySchema = paginationQuerySchema;

export type CreditActivityQuery = z.infer<typeof creditActivityQuerySchema>;

export const creditActivityResponseSchema = paginatedResultSchema(
	creditActivityItemSchema,
);

export type CreditActivityResponse = z.infer<
	typeof creditActivityResponseSchema
>;

// Free-user grant: 50 credits = $2.00 of AI-provider value at $0.04/credit
// (400 USD micros per centi-credit). The count is the stable product
// decision; the server writes it to the ledger x100 as centi-credits.
export const SIGNUP_GRANT_CREDITS = 50;

export const creditsRoutes = {
	balance: "/api/v1/credits/balance",
	balances: "/api/v1/credits/balances",
	ledger: "/api/v1/credits/ledger",
	activity: "/api/v1/credits/activity",
} as const;
