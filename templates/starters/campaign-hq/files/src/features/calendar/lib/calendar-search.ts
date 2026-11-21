// The search params of the calendar: the view, the month, the week, the campaign filter, and the channel filter live in the URL.
// The /app/calendar route validates the URL with this schema. The campaign page links here with `?campaign=`.
import { z } from "zod";
import { CHANNELS } from "~/features/marketing";

/** The views of the view menu. "agenda" lists the days of the month that have items. */
export const CALENDAR_VIEWS = ["month", "week", "agenda"] as const;

/** One view of the calendar. */
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/**
 * `view` absent means "month". `month` is YYYY-MM; absent means the current month.
 * `week` is any YYYY-MM-DD day of the week to show; absent means the first week of `month`, or this week.
 * An invalid value in the URL reads as absent.
 */
export const calendarSearchSchema = z.object({
	view: z.enum(CALENDAR_VIEWS).optional().catch(undefined),
	month: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
		.optional()
		.catch(undefined),
	week: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
		.optional()
		.catch(undefined),
	campaign: z.string().max(40).optional().catch(undefined),
	channel: z.enum(CHANNELS).optional().catch(undefined),
});
