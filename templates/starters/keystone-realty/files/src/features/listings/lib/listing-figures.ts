// The four figures of the listings page, each with its change against 30 days earlier.
// listings.queries.ts calls buildListingFigures with the listing rows of now and of 30 days ago.
// It reads no clock of its own.
import {
	changeRatio,
	DAY_MS,
	type ListingRow,
	medianOf,
} from "~/features/agency";

/** The figures compare the state now with the state this many days ago. */
export const FIGURES_COMPARE_DAYS = 30;

/** One figure of the listings page. */
export type ListingFigure = {
	/** null when no home counts, for example a median of no home. The card then shows a dash. */
	value: number | null;
	/** Ratio against the earlier value: 0.12 is +12 %. null with no earlier value. */
	change: number | null;
};

/** The figures of the listings page, in the order of the KPI row. */
export type ListingFigures = {
	/** Homes with an accepted offer that is not completed yet. */
	underOffer: ListingFigure;
	/** The median asking price of the homes on the market, in whole currency units. */
	medianAskingPrice: ListingFigure;
	/** The median whole days on the market of the homes on the market. A fall is good news. */
	medianDaysOnMarket: ListingFigure;
	/** Sales completed in the last 30 days, against the 30 days before. */
	soldRecently: ListingFigure;
};

function figure(
	current: number | null,
	previous: number | null,
): ListingFigure {
	return {
		value: current,
		change:
			current === null || previous === null
				? null
				: changeRatio(current, previous),
	};
}

function stateFigures(listings: ListingRow[]) {
	const active = listings.filter((listing) => listing.status === "active");
	return {
		underOffer: listings.filter((listing) => listing.status === "under_offer")
			.length,
		medianAskingPrice: medianOf(active.map((listing) => listing.askingPrice)),
		medianDaysOnMarket: medianOf(active.map((listing) => listing.daysOnMarket)),
	};
}

/** `before` holds the listing rows as they were 30 days before `now`. */
export function buildListingFigures(
	current: ListingRow[],
	before: ListingRow[],
	now: number,
): ListingFigures {
	const today = stateFigures(current);
	const earlier = stateFigures(before);
	const period = FIGURES_COMPARE_DAYS * DAY_MS;
	const soldBetween = (start: number, end: number) =>
		current.filter((listing) => {
			const soldAt =
				listing.soldAt === null ? Number.NaN : Date.parse(listing.soldAt);
			return soldAt >= start && soldAt < end;
		}).length;
	return {
		underOffer: figure(today.underOffer, earlier.underOffer),
		medianAskingPrice: figure(
			today.medianAskingPrice,
			earlier.medianAskingPrice,
		),
		medianDaysOnMarket: figure(
			today.medianDaysOnMarket,
			earlier.medianDaysOnMarket,
		),
		soldRecently: figure(
			soldBetween(now - period, now),
			soldBetween(now - 2 * period, now - period),
		),
	};
}
