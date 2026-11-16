// The figures of the leads page: the open pipeline, the sources of the last 30 days, and the answer times.
// LeadsPage calls these pure functions with the rows of the leads query. They read no clock of their own.
import {
	ANSWER_TARGET_HOURS,
	LEAD_SOURCES,
	type LeadRow,
	type LeadSource,
	type LeadStatus,
	medianOf,
	reportEndOf,
	reportStartOf,
} from "~/features/agency";

/** The statuses of a lead that is still open, in the order of the work. */
export const OPEN_STATUSES = [
	"new",
	"contacted",
	"viewing",
	"offer",
] as const satisfies readonly LeadStatus[];

/** One stage of the open pipeline with its count of leads. */
export type PipelineStage = {
	status: (typeof OPEN_STATUSES)[number];
	count: number;
};

/** The count of open leads per stage. A stage with no lead stays in the list with 0. */
export function buildPipeline(leads: LeadRow[]): PipelineStage[] {
	return OPEN_STATUSES.map((status) => ({
		status,
		count: leads.filter((lead) => lead.status === status).length,
	}));
}

/** One part of the source breakdown. "other" holds every source after the 5 largest. */
export type SourceSlice = {
	source: LeadSource | "other";
	/** Count of the leads of the last 30 days from this source. */
	value: number;
};

// A breakdown shows 5 parts at most, then "other".
const MAX_SLICES = 5;

/** The leads that arrived in the report period, per source: the 5 largest sources, then "other". */
export function buildSourceSlices(
	leads: LeadRow[],
	now: number,
): SourceSlice[] {
	const start = reportStartOf(now);
	const end = reportEndOf(now);
	const recent = leads.filter((lead) => {
		const createdAt = Date.parse(lead.createdAt);
		return createdAt >= start && createdAt < end;
	});
	const counted = LEAD_SOURCES.map((source) => ({
		source,
		value: recent.filter((lead) => lead.source === source).length,
	}))
		.filter((slice) => slice.value > 0)
		.sort((first, second) => second.value - first.value);
	const rest = counted
		.slice(MAX_SLICES)
		.reduce((sum, slice) => sum + slice.value, 0);
	return [
		...counted.slice(0, MAX_SLICES),
		...(rest > 0 ? [{ source: "other" as const, value: rest }] : []),
	];
}

/** How fast the agency answered the leads of the report period, and how many leads it won. */
export type AnswerStats = {
	/** The median minutes to the first answer. null when no lead of the period has an answer. */
	medianMinutes: number | null;
	/** The share of the answered leads with an answer inside the target, from 0 to 1. null with no answer. */
	inTargetShare: number | null;
	/** Count of the leads that were won in the period. */
	wonCount: number;
};

/** The answer figures for the leads that arrived in the report period that ends at `now`. */
export function buildAnswerStats(leads: LeadRow[], now: number): AnswerStats {
	const start = reportStartOf(now);
	const end = reportEndOf(now);
	const isInPeriod = (time: string) => {
		const ms = Date.parse(time);
		return ms >= start && ms < end;
	};
	const answerMinutes = leads.flatMap((lead) =>
		lead.answerMinutes !== null && isInPeriod(lead.createdAt)
			? [lead.answerMinutes]
			: [],
	);
	// 60 minutes in an hour.
	const targetMinutes = ANSWER_TARGET_HOURS * 60;
	return {
		medianMinutes: medianOf(answerMinutes),
		inTargetShare:
			answerMinutes.length === 0
				? null
				: answerMinutes.filter((minutes) => minutes <= targetMinutes).length /
					answerMinutes.length,
		wonCount: leads.filter(
			(lead) =>
				lead.status === "won" &&
				lead.closedAt !== null &&
				isInPeriod(lead.closedAt),
		).length,
	};
}
