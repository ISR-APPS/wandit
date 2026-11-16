// Day series of the channel rows: one point per day and channel, and the sums of a range of days.
// The overview queries and the campaign detail query call these pure functions on the sample rows.
// A later turn gets the same shapes from SQL read functions (STARTER.md).
import { CHANNELS, type Channel } from "./channels";
import { dayKeyOf } from "./format";
import { addTotals, emptyTotals, type MediaTotals } from "./metrics";
import { shiftDays } from "./relative-time";
import type { ChannelDayRow } from "./sample-data";

/** One day and one channel of a stacked trend. `day` is YYYY-MM-DD in the local time zone. */
export type ChannelPoint = {
	day: string;
	channel: Channel;
	value: number;
};

/**
 * One point per day and channel from day `firstOffset` to day `lastOffset` (days from today), oldest first.
 * A day with no row gives 0, so every bar of a chart has a place. `pick` chooses the metric.
 */
export function channelPoints(
	rows: ChannelDayRow[],
	dayStart: number,
	firstOffset: number,
	lastOffset: number,
	pick: (row: ChannelDayRow) => number,
): ChannelPoint[] {
	const sums = new Map<string, number>();
	for (const row of rows) {
		if (row.dayOffset >= firstOffset && row.dayOffset <= lastOffset) {
			const key = `${row.dayOffset}|${row.channel}`;
			sums.set(key, (sums.get(key) ?? 0) + pick(row));
		}
	}
	const points: ChannelPoint[] = [];
	for (let offset = firstOffset; offset <= lastOffset; offset++) {
		const day = dayKeyOf(shiftDays(dayStart, offset));
		for (const channel of CHANNELS) {
			points.push({
				day,
				channel,
				value: sums.get(`${offset}|${channel}`) ?? 0,
			});
		}
	}
	return points;
}

/** The totals of the rows from day `firstOffset` to day `lastOffset`, both included. */
export function totalsBetween(
	rows: ChannelDayRow[],
	firstOffset: number,
	lastOffset: number,
): MediaTotals {
	const totals = emptyTotals();
	for (const row of rows) {
		if (row.dayOffset >= firstOffset && row.dayOffset <= lastOffset) {
			addTotals(totals, row);
		}
	}
	return totals;
}

/** The totals of the rows per channel, in CHANNELS order. A channel with no row gives zeros. */
export function totalsByChannel(
	rows: ChannelDayRow[],
): Record<Channel, MediaTotals> {
	const byChannel = {
		paid_social: emptyTotals(),
		search: emptyTotals(),
		email: emptyTotals(),
		video: emptyTotals(),
		partners: emptyTotals(),
	} satisfies Record<Channel, MediaTotals>;
	for (const row of rows) {
		addTotals(byChannel[row.channel], row);
	}
	return byChannel;
}
