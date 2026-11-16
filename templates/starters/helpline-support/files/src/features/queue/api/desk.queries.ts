// Reads of the queue home: tickets solved per day, the desk figures of a period, and the tickets received by topic.
// The home route prefetches them for DEFAULT_DAYS. The Solved panel reads them again when the period changes.
// Each queryFn reads the sample tables. A later turn replaces it with one SQL read function per query.
import { queryOptions } from "@tanstack/react-query";
import {
	type BreakdownSlice,
	buildDailySeries,
	changeRatio,
	dayAge,
	getSampleTables,
	MINUTE_MS,
	median,
	RESOLUTION_TARGET_MINUTES,
	type TicketRow,
	type TicketTopic,
} from "~/features/helpdesk";
import type { TranslationKey } from "~/shared/i18n";

/** How the value of a desk figure reads: a count, a length of time in minutes, or a share from 0 to 1. */
export type FigureKind = "count" | "minutes" | "percent";

/** One figure of the strip in the Solved panel. The panel turns `labelKey` into a label with t(). */
export type DeskFigure = {
	/** Stable id, also the React key. */
	id: "solved" | "first-reply" | "within-sla" | "satisfaction";
	labelKey: TranslationKey;
	/** 0 when the period has no data for it. `hasValue` tells the two cases apart. */
	value: number;
	/** False when no ticket feeds the figure, for example no rating in 7 days. The cell then shows a dash. */
	hasValue: boolean;
	kind: FigureKind;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for reply times: a fall is good news. */
	goodWhen: "up" | "down";
};

// True when `timestamp` falls in the period of `days` days that ends today (offset 0) or in the one before (offset 1).
function inPeriod(
	timestamp: string,
	days: number,
	offset: 0 | 1,
	now: number,
): boolean {
	const age = dayAge(timestamp, now);
	return age >= offset * days && age < (offset + 1) * days;
}

// Minutes from the creation to the first reply. Only tickets with a reply count.
function replyMinutes(ticket: TicketRow): number | null {
	return ticket.firstReplyAt
		? (Date.parse(ticket.firstReplyAt) - Date.parse(ticket.createdAt)) /
				MINUTE_MS
		: null;
}

// The share of solved tickets that met the resolution target of their priority. null with no solved ticket.
function withinSlaShare(solved: TicketRow[]): number | null {
	if (solved.length === 0) {
		return null;
	}
	const met = solved.filter(
		(ticket) =>
			(Date.parse(ticket.solvedAt ?? ticket.createdAt) -
				Date.parse(ticket.createdAt)) /
				MINUTE_MS <=
			RESOLUTION_TARGET_MINUTES[ticket.priority],
	).length;
	return met / solved.length;
}

// The share of good ratings among the rated tickets. null with no rating.
function satisfactionShare(solved: TicketRow[]): number | null {
	const rated = solved.filter((ticket) => ticket.rating !== null);
	return rated.length === 0
		? null
		: rated.filter((ticket) => ticket.rating === "good").length / rated.length;
}

// A figure from the value of this period and of the period before. No value on either side: no delta.
function figure(
	base: Pick<DeskFigure, "id" | "labelKey" | "kind" | "goodWhen">,
	current: number | null,
	previous: number | null,
): DeskFigure {
	return {
		...base,
		value: current ?? 0,
		hasValue: current !== null,
		change:
			current === null || previous === null
				? null
				: changeRatio(current, previous),
	};
}

/** Tickets solved per day for the last `days` days, with the same days one period earlier. Feeds the heat calendar. */
export function solvedPerDayQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["tickets", "solved-per-day", days],
		queryFn: async () => {
			const now = Date.now();
			const events = getSampleTables().tickets.flatMap((ticket) =>
				ticket.solvedAt ? [{ occurredAt: ticket.solvedAt, value: 1 }] : [],
			);
			return buildDailySeries(events, days, now);
		},
	});
}

/** The 4 desk figures of the last `days` days, the most important first. */
export function deskFiguresQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["tickets", "desk-figures", days],
		queryFn: async (): Promise<DeskFigure[]> => {
			const now = Date.now();
			const { tickets } = getSampleTables();
			const solvedIn = (offset: 0 | 1) =>
				tickets.filter(
					(ticket) =>
						ticket.solvedAt !== null &&
						inPeriod(ticket.solvedAt, days, offset, now),
				);
			const repliesIn = (offset: 0 | 1) =>
				tickets
					.filter((ticket) => inPeriod(ticket.createdAt, days, offset, now))
					.flatMap((ticket) => {
						const minutes = replyMinutes(ticket);
						return minutes === null ? [] : [minutes];
					});
			const [solved, solvedBefore] = [solvedIn(0), solvedIn(1)];
			return [
				figure(
					{
						id: "solved",
						labelKey: "metrics.solved",
						kind: "count",
						goodWhen: "up",
					},
					solved.length,
					solvedBefore.length,
				),
				figure(
					{
						id: "first-reply",
						labelKey: "metrics.firstReply",
						kind: "minutes",
						goodWhen: "down",
					},
					median(repliesIn(0)),
					median(repliesIn(1)),
				),
				figure(
					{
						id: "within-sla",
						labelKey: "metrics.withinSla",
						kind: "percent",
						goodWhen: "up",
					},
					withinSlaShare(solved),
					withinSlaShare(solvedBefore),
				),
				figure(
					{
						id: "satisfaction",
						labelKey: "metrics.satisfaction",
						kind: "percent",
						goodWhen: "up",
					},
					satisfactionShare(solved),
					satisfactionShare(solvedBefore),
				),
			];
		},
	});
}

/** Tickets created in the last `days` days by topic, the largest first. "other" holds the rest. */
export function receivedByTopicQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["tickets", "by-topic", days],
		queryFn: async (): Promise<BreakdownSlice<TicketTopic>[]> => {
			const now = Date.now();
			const counts = new Map<TicketTopic, number>();
			for (const ticket of getSampleTables().tickets) {
				if (inPeriod(ticket.createdAt, days, 0, now)) {
					counts.set(ticket.topic, (counts.get(ticket.topic) ?? 0) + 1);
				}
			}
			const named = [...counts.entries()]
				.filter(([topic]) => topic !== "other")
				.map(([label, value]) => ({ label, value }))
				.sort((first, second) => second.value - first.value);
			// The 5 largest named topics stay. The rest joins "other", which always comes last.
			const kept = named.slice(0, 5);
			const otherValue =
				(counts.get("other") ?? 0) +
				named.slice(5).reduce((sum, slice) => sum + slice.value, 0);
			return otherValue > 0
				? [...kept, { label: "other", value: otherValue }]
				: kept;
		},
	});
}
