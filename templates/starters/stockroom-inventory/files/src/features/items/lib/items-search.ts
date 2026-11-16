// The search params of the item list: the stock level tab and the family filter.
// The /app/items route validates them; the list page reads and writes them, so a filter has its own URL.
// The home links here with a level, for example ?status=low.
import { z } from "zod";
import { STOCK_CATEGORIES, STOCK_STATUSES } from "~/features/stock";

/** Both params are optional. A missing or unknown value means "all". */
export const itemsSearchSchema = z.object({
	status: z.enum(STOCK_STATUSES).optional().catch(undefined),
	category: z.enum(STOCK_CATEGORIES).optional().catch(undefined),
});

/** The params after validation. */
export type ItemsSearch = z.infer<typeof itemsSearchSchema>;
