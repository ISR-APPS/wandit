// The search param of the supplier page: the id of the supplier whose panel is open.
// The /app/suppliers route validates it. The item page and the order panel link with it.
import { z } from "zod";

/** `supplier` is optional. An unknown id opens no panel. */
export const suppliersSearchSchema = z.object({
	supplier: z.string().max(40).optional().catch(undefined),
});

/** The params after validation. */
export type SuppliersSearch = z.infer<typeof suppliersSearchSchema>;
