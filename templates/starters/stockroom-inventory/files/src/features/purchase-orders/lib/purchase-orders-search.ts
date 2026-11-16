// The search params of the order list: the status or late tab, the supplier filter, and the open order panel.
// The /app/purchase-orders route validates them. The home, the item page, and the supplier panel link with `po`.
// The home links with `late` from its attention card.
import { z } from "zod";
import { PURCHASE_ORDER_STATUSES } from "~/features/stock";

/** Every param is optional. A missing or unknown status means "all"; an unknown supplier or order shows nothing extra. */
export const purchaseOrdersSearchSchema = z.object({
	status: z.enum(PURCHASE_ORDER_STATUSES).optional().catch(undefined),
	/** true opens the Late tab: open orders past their expected day, of any status. It wins over `status`. */
	late: z.boolean().optional().catch(undefined),
	/** A supplier id, for example "corrie-box". The page ignores an id that has no order. */
	supplier: z.string().max(40).optional().catch(undefined),
	/** An order id, for example "po-24117". It opens the order panel. */
	po: z.string().max(20).optional().catch(undefined),
});

/** The params after validation. */
export type PurchaseOrdersSearch = z.infer<typeof purchaseOrdersSearchSchema>;
