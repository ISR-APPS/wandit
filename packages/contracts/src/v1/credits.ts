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

export const creditBuckets = ["plan", "topup"] as const;

export const creditBucketSchema = z.enum(creditBuckets);

export type CreditBucket = z.infer<typeof creditBucketSchema>;

export const creditBalanceResponseSchema = z.object({
	balance: z.int(),
	plan: z.int(),
	topup: z.int(),
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

export const SIGNUP_GRANT_CREDITS = 100;

/** Shared ledger key for an image-to-video credit reservation/refund pair. */
export function mediaGenerationReservationKey(attemptId: string): string {
	return `media-generation:${attemptId}`;
}

export const creditsRoutes = {
	balance: "/api/v1/credits/balance",
	ledger: "/api/v1/credits/ledger",
} as const;
