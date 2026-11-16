// The search params of the transactions list: the type tab and the category filter.
// The /app/transactions route validates the URL with the schema. The page and the links of other features use the type.
import { z } from "zod";
import { CATEGORY_IDS, TRANSACTION_TYPES } from "~/features/ledger";

/** `?type=expense&category=software`. A value that is not in the list reads as "no filter". */
export const transactionsSearchSchema = z.object({
	type: z.enum(TRANSACTION_TYPES).optional().catch(undefined),
	category: z.enum(CATEGORY_IDS).optional().catch(undefined),
});

/** The filters of the list. An absent key shows every type or every category. */
export type TransactionsSearch = z.infer<typeof transactionsSearchSchema>;
