// The search params of the order list: the status tab lives in the URL, as /app/orders?status=to_ship.
// The /app/orders route validates the URL with this schema. The home links to the orders to ship with it.
import { z } from "zod";
import { ORDER_STATUSES } from "~/features/shop";

/** `status` is absent for the "All" tab. An unknown value in the URL also reads as absent. */
export const ordersSearchSchema = z.object({
	status: z.enum(ORDER_STATUSES).optional().catch(undefined),
});
