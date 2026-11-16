// The attention rules of an open deal: stalled in its stage, or past its expected close date.
// The board slips, the deal list, and the deal page read them, so all three flag the same deals.
import {
	calendarDaysFromNow,
	isOpenStage,
	STALLED_AFTER_DAYS,
} from "~/features/crm";
import type { Deal } from "../api/deals.queries";

/** Calendar days since the deal entered its current stage. 0 on the day of the change. */
export function daysInStage(deal: Deal, now: number): number {
	return -calendarDaysFromNow(deal.stageChangedAt, now);
}

/** True when an open deal sits in one stage for STALLED_AFTER_DAYS days or more. A closed deal never stalls. */
export function isStalled(deal: Deal, now: number): boolean {
	return (
		isOpenStage(deal.stage) && daysInStage(deal, now) >= STALLED_AFTER_DAYS
	);
}

/** True when the expected close day of an open deal is before today. */
export function isPastCloseDate(deal: Deal, now: number): boolean {
	return (
		isOpenStage(deal.stage) &&
		calendarDaysFromNow(deal.expectedCloseAt, now) < 0
	);
}
