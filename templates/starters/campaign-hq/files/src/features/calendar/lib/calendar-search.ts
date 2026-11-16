// The search params of the calendar: the month, the campaign filter, and the channel filter live in the URL.
// The /app/calendar route validates the URL with this schema. The campaign page links here with `?campaign=`.
import { z } from "zod";
import { CHANNELS } from "~/features/marketing";

/** `month` is YYYY-MM; absent means the current month. An invalid value in the URL also reads as absent. */
export const calendarSearchSchema = z.object({
	month: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
		.optional()
		.catch(undefined),
	campaign: z.string().max(40).optional().catch(undefined),
	channel: z.enum(CHANNELS).optional().catch(undefined),
});
