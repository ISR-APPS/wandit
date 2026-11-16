// The search params of the billing page: the invoice whose dialog is open lives in the URL (?invoice=inv-42).
// The /app/billing route validates the URL with this schema. The matter and client pages link to one invoice with it.
import { z } from "zod";

/** `invoice` is the id of the open dialog. The dialog query checks that the id exists. */
export const billingSearchSchema = z.object({
	invoice: z.string().max(40).optional().catch(undefined),
});
