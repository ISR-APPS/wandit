// The search params of the customers page: the plan filter, and the customer whose sheet is open.
// The /app/customers route validates the URL with this schema. The ticket thread links to a customer with it.
import { z } from "zod";
import { CUSTOMER_PLANS } from "~/features/helpdesk";

/** Both params are optional. An unknown value in the URL reads as absent. */
export const customersSearchSchema = z.object({
	plan: z.enum(CUSTOMER_PLANS).optional().catch(undefined),
	/** A customer id, for example "cus-07". The page shows no sheet when no customer has it. */
	customer: z.string().max(40).optional().catch(undefined),
});
