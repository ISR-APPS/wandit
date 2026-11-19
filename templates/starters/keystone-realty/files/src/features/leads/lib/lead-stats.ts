// The figures of the leads page for one period: the answer target, three counts with their change,
// the sources, the open pipeline, and the next follow-ups. leads.queries.ts calls buildLeadsSummary;
// the follow-up card calls buildFollowUps. They read no clock of their own.
import {
	ANSWER_TARGET_HOURS,
	changeRatio,
	DAY_MS,
	HOUR_MS,
	LEAD_SOURCES,
	type LeadRow,
	type LeadSource,
	type LeadStatus,
	type ViewingRow,
} from "~/features/agency";

/** The period choices of the leads page, in days. The sample data covers two periods of the longest one. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice, in days. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** The statuses of a lead that is still open, in the order of the work. */
export const OPEN_STATUSES = [
	"new",
	"contacted",
	"viewing",
	"offer",
] as const satisfies readonly LeadStatus[];

/** One count of the period with its change against the period before. */
export type PeriodCount = {
	value: number;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null when it had none. */
	change: number | null;
};

/** One row of the pipeline card: an open stage now, or the leads won in the period. */
export type PipelineRow = {
	stage: (typeof OPEN_STATUSES)[number] | "won";
	count: number;
	/** The sum of the asking prices of the homes that these leads ask about, in whole currency units. */
	amount: number;
};

/** One part of the source donut. "other" sums the sources after the 3 largest. */
export type SourceSlice = { source: LeadSource | "other"; value: number };

// The donut shows 3 named sources and "other". The 2 x 2 legend has room for 4 parts.
const NAMED_SOURCES = 3;

/** The goal of the agency: this share of the leads gets an answer inside the target hours. */
export const ANSWER_GOAL_SHARE = 0.9;

/** Everything that the leads page shows for one period. */
export type LeadsSummary = {
	/** The share of the answered leads of the period with an answer inside the target, from 0 to 1. null with no answer. */
	answerShare: number | null;
	/** Count of the leads of the period with an answer. */
	answeredCount: number;
	newLeads: PeriodCount;
	viewingsHeld: PeriodCount;
	offersMade: PeriodCount;
	/** The new leads of the period: the 3 largest sources, then "other" for the rest. Always 4 parts. */
	sources: SourceSlice[];
	pipeline: PipelineRow[];
};

function isBetween(time: string | null, start: number, end: number): boolean {
	const ms = time === null ? Number.NaN : Date.parse(time);
	return ms >= start && ms < end;
}

function periodCount(
	times: (string | null)[],
	start: number,
	end: number,
	length: number,
): PeriodCount {
	const value = times.filter((time) => isBetween(time, start, end)).length;
	const previous = times.filter((time) =>
		isBetween(time, start - length, start),
	).length;
	return { value, change: changeRatio(value, previous) };
}

function sourceSlicesOf(leads: LeadRow[]): SourceSlice[] {
	const bySource = LEAD_SOURCES.map((source) => ({
		source,
		value: leads.filter((lead) => lead.source === source).length,
	})).sort((first, second) => second.value - first.value);
	const rest = bySource.slice(NAMED_SOURCES);
	return [
		...bySource.slice(0, NAMED_SOURCES),
		{ source: "other", value: rest.reduce((sum, part) => sum + part.value, 0) },
	];
}

/** The summary of the `days` days that end at `now`. */
export function buildLeadsSummary(
	leads: LeadRow[],
	viewings: ViewingRow[],
	days: PeriodDays,
	now: number,
): LeadsSummary {
	const length = days * DAY_MS;
	const start = now - length;
	const ofPeriod = leads.filter((lead) =>
		isBetween(lead.createdAt, start, now),
	);
	const answered = ofPeriod.flatMap((lead) =>
		lead.answerMinutes === null ? [] : [lead.answerMinutes],
	);
	// 60 minutes in an hour.
	const targetMinutes = ANSWER_TARGET_HOURS * 60;
	const pipelineRow = (
		stage: PipelineRow["stage"],
		rows: LeadRow[],
	): PipelineRow => ({
		stage,
		count: rows.length,
		amount: rows.reduce((sum, lead) => sum + (lead.listingPrice ?? 0), 0),
	});
	return {
		answerShare:
			answered.length === 0
				? null
				: answered.filter((minutes) => minutes <= targetMinutes).length /
					answered.length,
		answeredCount: answered.length,
		newLeads: periodCount(
			leads.map((lead) => lead.createdAt),
			start,
			now,
			length,
		),
		viewingsHeld: periodCount(
			viewings
				.filter((viewing) => viewing.status === "completed")
				.map((viewing) => viewing.startsAt),
			start,
			now,
			length,
		),
		offersMade: periodCount(
			leads.map((lead) => lead.offerAt),
			start,
			now,
			length,
		),
		sources: sourceSlicesOf(ofPeriod),
		pipeline: [
			...OPEN_STATUSES.map((status) =>
				pipelineRow(
					status,
					leads.filter((lead) => lead.status === status),
				),
			),
			pipelineRow(
				"won",
				leads.filter(
					(lead) =>
						lead.status === "won" && isBetween(lead.closedAt, start, now),
				),
			),
		],
	};
}

/** The urgency of a follow-up. The label is the message `leads.priorities.<priority>`. */
export type FollowUpPriority = "high" | "medium" | "low";

/** The next action on one open lead. */
export type FollowUp = {
	lead: LeadRow;
	/** The kind of action. The title is the message `leads.followUps.<action>`. */
	action: "answer" | "bookViewing" | "askFeedback" | "chaseOffer";
	priority: FollowUpPriority;
	/** ISO time since the lead waits for this action: the arrival, the answer, or the offer. */
	since: string;
};

// A contacted lead with no viewing after this many hours needs a nudge: 3 days.
const NUDGE_AFTER_HOURS = 72;

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } satisfies Record<
	FollowUpPriority,
	number
>;

/**
 * The next action of every open lead, the most urgent first: by priority, then the longest wait.
 * A late answer and an open offer are high. A lead that waits less than the target is medium.
 */
export function buildFollowUps(leads: LeadRow[], now: number): FollowUp[] {
	const followUps = leads.flatMap((lead): FollowUp[] => {
		switch (lead.status) {
			case "new":
				return [
					{
						lead,
						action: "answer",
						priority: lead.isLate ? "high" : "medium",
						since: lead.createdAt,
					},
				];
			case "contacted": {
				const since = lead.firstResponseAt ?? lead.createdAt;
				return [
					{
						lead,
						action: "bookViewing",
						priority:
							now - Date.parse(since) > NUDGE_AFTER_HOURS * HOUR_MS
								? "medium"
								: "low",
						since,
					},
				];
			}
			case "viewing":
				return [
					{
						lead,
						action: "askFeedback",
						priority: "low",
						since: lead.firstResponseAt ?? lead.createdAt,
					},
				];
			case "offer":
				return [
					{
						lead,
						action: "chaseOffer",
						priority: "high",
						since: lead.offerAt ?? lead.createdAt,
					},
				];
			default:
				return [];
		}
	});
	return followUps.sort(
		(first, second) =>
			PRIORITY_ORDER[first.priority] - PRIORITY_ORDER[second.priority] ||
			first.since.localeCompare(second.since),
	);
}
