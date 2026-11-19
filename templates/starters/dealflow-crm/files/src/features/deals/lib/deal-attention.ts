// The attention rules of an open deal: stalled in its stage, or past its expected close date.
// The board cards, the deal tables, the home table, and the deal page read them, so all of them flag the same deals.
import {
	calendarDaysFromNow,
	isOpenStage,
	isStalledDeal,
} from "~/features/crm";
import type { Deal } from "../api/deals.queries";

/** Calendar days since the deal entered its current stage. 0 on the day of the change. */
export function daysInStage(deal: Deal, now: number): number {
	return -calendarDaysFromNow(deal.stageChangedAt, now);
}

/** True when the expected close day of an open deal is before today. */
export function isPastCloseDate(deal: Deal, now: number): boolean {
	return (
		isOpenStage(deal.stage) &&
		calendarDaysFromNow(deal.expectedCloseAt, now) < 0
	);
}

/** True when an open deal is stalled or past its expected close day. The home table lists these deals. */
export function needsAttention(deal: Deal, now: number): boolean {
	return isStalledDeal(deal, now) || isPastCloseDate(deal, now);
}
