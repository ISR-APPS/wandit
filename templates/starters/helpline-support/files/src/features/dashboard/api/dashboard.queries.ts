// Read of the home figures for one period: the four KPIs, created against solved per day,
// the new tickets by channel, and the open tickets per agent now.
// The /app route loader prefetches the default period. DashboardPage reads the other periods after a change.
// The queryFn reads the sample tables. A later turn replaces its body with SQL read functions that return the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type BreakdownSlice,
	buildDailySeries,
	changeRatio,
	dayAge,
	getSampleTables,
	isLate,
	isOpenStatus,
	MINUTE_MS,
	median,
	type PeriodDays,
	slaDueAt,
	TICKET_CHANNELS,
	type TicketChannel,
	type TicketRow,
} from "~/features/helpdesk";

/** The period of the first load of the home, in days. */
export const DASHBOARD_DEFAULT_DAYS = 30 satisfies PeriodDays;

// The workload card lists the busiest agents, then one "Unassigned" row: 5 rows, one chart color each.
// The other agents stay out of the list. Their tickets are the muted rest of the share bar.
const SHOWN_AGENTS = 4;

/** One figure and its change against the period before. `change` is a ratio, null when no earlier value exists. */
type Figure = { value: number | null; change: number | null };

/** One day of the created-against-solved chart. */
export type FlowPoint = {
	/** YYYY-MM-DD in the browser time zone. */
	day: string;
	/** Tickets created on that day. */
	created: number;
	/** Tickets solved on that day. */
	solved: number;
};

/** One row of the workload card: an agent and the open tickets that the agent owns now. */
export type AgentLoad = {
	/** The agent id, or "unassigned" for the open tickets that nobody took. */
	id: string;
	/** The agent name. null on the "unassigned" row; the card shows its translated label. */
	name: string | null;
	/** Open tickets now: new, open, and pending. */
	open: number;
	/** The open tickets past their SLA deadline. */
	late: number;
};

/** The figures of the home for one period. Times are in minutes. */
export type DashboardSummary = {
	/**
	 * Open tickets now: a snapshot, not a figure of the period. `late` passed the SLA deadline, `unassigned` has no agent.
	 * The card names these two parts in place of a delta.
	 */
	openTickets: { value: number; late: number; unassigned: number };
	/** Median minutes to the first reply, over the tickets created in the period. */
	firstReply: Figure & { count: number };
	/** Median minutes from creation to solve, over the tickets solved in the period. */
	resolution: Figure & { count: number };
	/** Share of good ratings, 0 to 1, over the tickets solved and rated in the period. */
	satisfaction: Figure & { count: number };
	/** One point per day of the period, oldest first. */
	flow: FlowPoint[];
	/** The tickets created in the period, per channel, largest first. One entry per channel, also at 0. */
	channels: BreakdownSlice<TicketChannel>[];
	/** The 4 busiest agents, then the unassigned open tickets. */
	workload: AgentLoad[];
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

// Minutes between two ISO times.
function minutesBetween(from: string, to: string): number {
	return (Date.parse(to) - Date.parse(from)) / MINUTE_MS;
}

// The share of good ratings among the rated tickets. null with no rating.
function goodShare(tickets: TicketRow[]): number | null {
	const rated = tickets.filter((ticket) => ticket.rating !== null);
	return rated.length === 0
		? null
		: rated.filter((ticket) => ticket.rating === "good").length / rated.length;
}

// A figure from the value of this period and of the period before. No value on either side: no delta.
function figure(current: number | null, previous: number | null): Figure {
	return {
		value: current,
		change:
			current === null || previous === null
				? null
				: changeRatio(current, previous),
	};
}

/** The home figures of the last `days` days. */
export function dashboardQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["tickets", "dashboard", days],
		queryFn: async (): Promise<DashboardSummary> => {
			const now = Date.now();
			const tables = getSampleTables();
			const { tickets } = tables;

			const createdIn = (offset: 0 | 1) =>
				tickets.filter((ticket) =>
					inPeriod(ticket.createdAt, days, offset, now),
				);
			const solvedIn = (offset: 0 | 1) =>
				tickets.filter(
					(ticket) =>
						ticket.solvedAt !== null &&
						inPeriod(ticket.solvedAt, days, offset, now),
				);
			const replyMinutes = (rows: TicketRow[]) =>
				rows.flatMap((ticket) =>
					ticket.firstReplyAt === null
						? []
						: [minutesBetween(ticket.createdAt, ticket.firstReplyAt)],
				);
			const solveMinutes = (rows: TicketRow[]) =>
				rows.map((ticket) =>
					minutesBetween(ticket.createdAt, ticket.solvedAt ?? ticket.createdAt),
				);
			const [created, createdBefore] = [createdIn(0), createdIn(1)];
			const [solved, solvedBefore] = [solvedIn(0), solvedIn(1)];
			const replies = replyMinutes(created);
			const openNow = tickets.filter((ticket) => isOpenStatus(ticket.status));
			const createdPoints = buildDailySeries(
				tickets.map((ticket) => ({ occurredAt: ticket.createdAt, value: 1 })),
				days,
				now,
			);
			const solvedPoints = buildDailySeries(
				solved.map((ticket) => ({
					occurredAt: ticket.solvedAt ?? ticket.createdAt,
					value: 1,
				})),
				days,
				now,
			);

			const loads = new Map<string, AgentLoad>(
				tables.agents.map((agent) => [
					agent.id,
					{ id: agent.id, name: agent.name, open: 0, late: 0 },
				]),
			);
			const unassigned: AgentLoad = {
				id: "unassigned",
				name: null,
				open: 0,
				late: 0,
			};
			for (const ticket of openNow) {
				// An assignee that is not in the agents table counts as unassigned, so every open ticket counts in one row.
				const load =
					ticket.assigneeId === null
						? unassigned
						: (loads.get(ticket.assigneeId) ?? unassigned);
				load.open += 1;
				if (
					isLate(
						slaDueAt(ticket.status, ticket.priority, ticket.createdAt),
						now,
					)
				) {
					load.late += 1;
				}
			}

			return {
				openTickets: {
					value: openNow.length,
					late: [...loads.values(), unassigned].reduce(
						(sum, load) => sum + load.late,
						0,
					),
					unassigned: unassigned.open,
				},
				firstReply: {
					...figure(median(replies), median(replyMinutes(createdBefore))),
					count: replies.length,
				},
				resolution: {
					...figure(
						median(solveMinutes(solved)),
						median(solveMinutes(solvedBefore)),
					),
					count: solved.length,
				},
				satisfaction: {
					...figure(goodShare(solved), goodShare(solvedBefore)),
					count: solved.filter((ticket) => ticket.rating !== null).length,
				},
				flow: createdPoints.map((point, index) => ({
					day: point.day,
					created: point.current,
					solved: solvedPoints[index]?.current ?? 0,
				})),
				channels: TICKET_CHANNELS.map((channel) => ({
					label: channel,
					value: created.filter((ticket) => ticket.channel === channel).length,
				})).sort((first, second) => second.value - first.value),
				workload: [
					...[...loads.values()]
						.sort((first, second) => second.open - first.open)
						.slice(0, SHOWN_AGENTS),
					unassigned,
				],
			};
		},
	});
}
