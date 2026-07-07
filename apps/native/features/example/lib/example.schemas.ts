import { z } from "zod";

/**
 * example.schemas.ts — the shapes of this feature's data + Zod validators.
 *
 * ⚠️ IN A REAL FEATURE, THESE LIVE IN @wandit/contracts, not here. The whole
 * point of the contracts package is that the phone and the website validate the
 * EXACT same shapes, so they can never disagree about what an "example" is.
 *
 * They are defined locally in this template only so the example compiles on its
 * own. When you copy this feature, delete these and import from @wandit/contracts:
 *
 *     import { exampleSchema, type Example } from "@wandit/contracts";
 */

// One record as the server returns it.
export const exampleSchema = z.object({
	id: z.string(),
	title: z.string(),
	createdAt: z.string(),
});
export type Example = z.infer<typeof exampleSchema>;

// A list of records (used to validate the GET /examples response).
export const exampleListSchema = z.array(exampleSchema);

// The body we send when creating a record. Kept separate from Example because the
// client never sends id/createdAt — the server assigns those.
export const createExampleInputSchema = z.object({
	title: z.string().min(1),
});
export type CreateExampleInput = z.infer<typeof createExampleInputSchema>;
