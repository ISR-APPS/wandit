import { z } from "zod";
import {
	paginatedResultSchema,
	paginationQuerySchema,
} from "../http/pagination";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Credits contracts (docs/features/credits.md + docs/features/billing.md).
// The ledger is append-only and payment-provider-agnostic; balance =
// sum(delta). Per-action costs live here so web price tags and server debits
// never disagree.

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

export const creditBalanceResponseSchema = z.object({
	plan: z.int(),
	promo: z.int(),
	topup: z.int(),
	balance: z.int(),
});

export type CreditBalanceResponse = z.infer<typeof creditBalanceResponseSchema>;

export const creditLedgerRowSchema = z.object({
	id: uuidSchema,
	organizationId: z.string().nullable(),
	delta: z.int(),
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

export const CREDIT_COSTS = {
	landingPageGeneration: 10,
	chatMessage: 1,
	imageGeneration: 5,
	marketingAssetGeneration: 5,
	videoGeneration: 25,
} as const;

// Free-user grant: 50 credits = $5 face value = $1.40 of AI-provider value at
// $0.028/credit. The count is the stable product decision; its dollar value
// floats with AI_USD_PER_CREDIT.
export const SIGNUP_GRANT_CREDITS = 50;

export const creditsRoutes = {
	balance: "/api/v1/credits/balance",
	ledger: "/api/v1/credits/ledger",
} as const;
