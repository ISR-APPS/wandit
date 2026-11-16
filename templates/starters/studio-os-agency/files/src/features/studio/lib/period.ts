// The period choices of the overview and the Team page: the last 7, 30, or 90 complete days.
// The period tabs, the overview search, and the team queries read these values.
import { z } from "zod";

/** The period choices, in days. The sample data holds 180 days, so 90 days still has a previous period. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** The period of the first load. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** The period of a text such as "30", or null for any other text. */
export function parsePeriodDays(value: string): PeriodDays | null {
	return PERIOD_DAYS.find((days) => String(days) === value) ?? null;
}

/** The `days` search param. A missing or unknown value gives DEFAULT_DAYS, so an old link still works. */
export const periodDaysSchema = z
	.custom<PeriodDays>((value) => PERIOD_DAYS.some((days) => days === value))
	.default(DEFAULT_DAYS)
	.catch(DEFAULT_DAYS);
