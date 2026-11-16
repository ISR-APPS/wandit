// The search params of the customer page: the open customer lives in the URL, as /app/customers?customer=cus-012.
// The /app/customers route validates the URL with this schema. The order page links to a customer with it.
import { z } from "zod";

/** `customer` is absent while the panel is closed. An id with no row also keeps the panel closed. */
export const customersSearchSchema = z.object({
	customer: z.string().max(40).optional().catch(undefined),
});
