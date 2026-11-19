// The search params of the item list: the stock level, the family, and the supplier filters.
// The /app/items route validates them; the list page reads and writes them, so a filter has its own URL.
// The home links here with a level (?status=low), and the supplier list with a supplier.
import { z } from "zod";
import { STOCK_CATEGORIES, STOCK_STATUSES } from "~/features/stock";

/** Every param is optional. A missing or unknown value means "all". */
export const itemsSearchSchema = z.object({
	status: z.enum(STOCK_STATUSES).optional().catch(undefined),
	category: z.enum(STOCK_CATEGORIES).optional().catch(undefined),
	/** A supplier id, for example "harrow-finch". An id with no item gives an empty list. */
	supplier: z.string().max(40).optional().catch(undefined),
});

/** The params after validation. */
export type ItemsSearch = z.infer<typeof itemsSearchSchema>;
