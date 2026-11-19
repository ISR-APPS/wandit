// The search params of the order list: the status tab, the supplier and delivery filters, and the open order panel.
// The /app/purchase-orders route validates them. The home, the item page, the supplier list, and the bell link with them.
import { z } from "zod";
import { PURCHASE_ORDER_STATUSES } from "~/features/stock";

/** Every param is optional. A missing or unknown status means "all"; an unknown supplier or order shows nothing extra. */
export const purchaseOrdersSearchSchema = z.object({
	status: z.enum(PURCHASE_ORDER_STATUSES).optional().catch(undefined),
	/** true keeps the orders past their expected day; false keeps the others. Missing keeps both. */
	late: z.boolean().optional().catch(undefined),
	/** A supplier id, for example "harrow-finch". An id with no order gives an empty list. */
	supplier: z.string().max(40).optional().catch(undefined),
	/** An order id, for example "po-24117". It opens the order panel. */
	po: z.string().max(20).optional().catch(undefined),
});

/** The params after validation. */
export type PurchaseOrdersSearch = z.infer<typeof purchaseOrdersSearchSchema>;
