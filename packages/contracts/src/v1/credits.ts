import { z } from "zod";

// Credits contracts (docs/features/credits.md). Structural stub — schemas
// land with the feature slice. The ledger is append-only and
// payment-provider-agnostic; balance = sum(delta). Per-action credit COSTS
// become typed constants in this file so web price tags and server debits can
// never disagree (values TBD — placeholders in docs/features/credits.md).

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

// Draft route map — finalize with the feature slice.
export const creditsRoutes = {
	balance: "/api/v1/credits/balance",
	ledger: "/api/v1/credits/ledger",
} as const;
