// Zod schemas of the two forms of the Reports page: a new schedule and a new note.
// The schedule form and the notes card parse their fields with them before they call a mutation.
import { z } from "zod";

/** The reports that a schedule can send. Labels: `reports.kinds.<kind>`. */
export const REPORT_KINDS = ["signUps", "retention", "activeUsers"] as const;

/** One report that a schedule sends. */
export type ReportKind = (typeof REPORT_KINDS)[number];

/** How often a schedule sends its report. Labels: `reports.frequencies.<frequency>`. */
export const FREQUENCIES = ["daily", "weekly", "monthly"] as const;

/** One send rhythm of a schedule. */
export type Frequency = (typeof FREQUENCIES)[number];

/** The hours of the day that a schedule can send at, in the time zone of the browser. */
export const SEND_HOURS = [7, 8, 9, 12, 17] as const;

/** The fields of the schedule form. The weekday is 1 (Monday) to 5 (Friday) and only matters for "weekly". */
export const scheduleSchema = z.object({
	kind: z.enum(REPORT_KINDS),
	recipientName: z.string().trim().min(1).max(80),
	recipientEmail: z.email(),
	frequency: z.enum(FREQUENCIES),
	weekday: z.coerce.number().int().min(1).max(5),
	hour: z.coerce.number().int().min(0).max(23),
});

/** A valid schedule form. */
export type ScheduleInput = z.infer<typeof scheduleSchema>;

/** The text of a new note: 1 to 500 characters after trimming. */
export const noteSchema = z.string().trim().min(1).max(500);
