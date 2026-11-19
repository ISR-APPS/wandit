// Groups deals into the columns of the deal board, and sums the lost deals of the board period.
// DealsPage calls buildBoard on each render. The function is pure: the same deals and time give the same board.
import { calendarDaysFromNow, WINNING_PATH } from "~/features/crm";
import type { Deal } from "../api/deals.queries";

/** The days that the won column and the lost line cover, today included. */
export const BOARD_DAYS = 30;

/** The cards that a column shows. The link under them opens the rest in the table view. */
export const COLUMN_CARDS = 12;

/** One column of the board: a stage of the winning path and its deals. */
export type BoardColumn = {
	stage: (typeof WINNING_PATH)[number];
	/** Open stages: the deal that waits longest comes first. Won: the newest win comes first. */
	deals: Deal[];
	/** The sum of the amounts of `deals`, in whole units of the app currency. */
	amount: number;
};

/** The board of the Deals page. */
export type Board = {
	columns: BoardColumn[];
	/** The deals lost in the last BOARD_DAYS days. They get a line under the board, not a column. */
	lost: { count: number; amount: number };
};

function sumAmounts(deals: Deal[]): number {
	return deals.reduce((sum, deal) => sum + deal.amount, 0);
}

// True when the deal closed in the last BOARD_DAYS calendar days.
function closedInPeriod(deal: Deal, now: number): boolean {
	return (
		deal.closedAt !== null &&
		calendarDaysFromNow(deal.closedAt, now) > -BOARD_DAYS
	);
}

/** `deals` is the list after the search and the owner filter. `now` is the current time in milliseconds since 1970. */
export function buildBoard(deals: Deal[], now: number): Board {
	const columns = WINNING_PATH.map((stage) => {
		const ofStage = deals.filter((deal) => deal.stage === stage);
		const shown =
			stage === "won"
				? // Without the period, the won column grows forever.
					ofStage
						.filter((deal) => closedInPeriod(deal, now))
						.sort((first, second) =>
							second.stageChangedAt.localeCompare(first.stageChangedAt),
						)
				: ofStage.sort((first, second) =>
						first.stageChangedAt.localeCompare(second.stageChangedAt),
					);
		return { stage, deals: shown, amount: sumAmounts(shown) };
	});
	const lostDeals = deals.filter(
		(deal) => deal.stage === "lost" && closedInPeriod(deal, now),
	);
	return {
		columns,
		lost: { count: lostDeals.length, amount: sumAmounts(lostDeals) },
	};
}
