/**
 * read_lead_performance — the merchant's own lead funnel for the chat's
 * project, straight from the leads table (the Leads tab). The COD truth lives
 * here, not in the ad platforms: a "purchase" on Meta is a form submit; only
 * the confirmation / delivery / return counts say whether the money came in.
 *
 * Read-only and cheap: one ungrouped aggregate for the totals plus one grouped
 * aggregate for the rows (both scoped to deps.projectId), a tiny input
 * (window + grouping), and a note that spells out the scope and the rate
 * definitions so the model cannot misread them.
 */
import {
	type LeadFunnelCounts,
	type ReadLeadPerformanceInput,
	type ReadLeadPerformanceOutput,
	readLeadPerformanceInputSchema,
	readLeadPerformanceOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import type {
	LeadFunnelCountRow,
	LeadFunnelGroupBy,
	LeadsRepository,
} from "../../../leads/infrastructure/persistence/leads.repository";

export type ReadLeadPerformanceToolDeps = {
	leadsRepository: Pick<LeadsRepository, "getFunnelCountsForProject">;
	// Injectable clock for the specs; defaults to Date.now.
	now?: () => Date;
	projectId: string;
};

export const READ_LEAD_PERFORMANCE_DEFAULT_DAYS = 30;
export const READ_LEAD_PERFORMANCE_DEFAULT_GROUP_BY: LeadFunnelGroupBy =
	"source";
export const READ_LEAD_PERFORMANCE_GROUP_LIMIT = 50;
export const NO_UTM_CAMPAIGN_KEY = "(no utm_campaign)";

const ALGIERS_TIME_ZONE = "Africa/Algiers";

export type LeadFunnelRates = {
	confirmationRate: number | null;
	deliveryRate: number | null;
	returnRate: number | null;
};

function ratio(numerator: number, denominator: number): number | null {
	if (denominator <= 0) {
		return null;
	}

	return numerator / denominator;
}

/**
 * The three COD funnel rates. confirmationRate = every lead that passed the
 * confirmation call (confirmed, shipped, delivered, returned) over ALL leads
 * in the window — to_confirm stays in the denominator, so a fresh window
 * reads low until the call center catches up. deliveryRate / returnRate are
 * over the shipped population only (shipped + delivered + returned); a
 * "shipped" lead is still in transit. null when the denominator is 0.
 */
export function computeLeadFunnelRates(
	counts: LeadFunnelCounts,
): LeadFunnelRates {
	const shippedPopulation = counts.shipped + counts.delivered + counts.returned;

	return {
		confirmationRate: ratio(counts.confirmed + shippedPopulation, counts.total),
		deliveryRate: ratio(counts.delivered, shippedPopulation),
		returnRate: ratio(counts.returned, shippedPopulation),
	};
}

function algiersWallClockParts(at: Date): {
	day: number;
	month: number;
	year: number;
} {
	const parts = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "2-digit",
		timeZone: ALGIERS_TIME_ZONE,
		year: "numeric",
	}).formatToParts(at);
	const read = (type: "day" | "month" | "year") =>
		Number(parts.find((part) => part.type === type)?.value);

	return { day: read("day"), month: read("month"), year: read("year") };
}

/**
 * Start (UTC instant) of the Africa/Algiers calendar day `daysAgo` days
 * before the Algiers day containing `now` — the same day boundary
 * getTotalsForProject uses for "today". Algiers has no DST, so the offset
 * observed at `now` is the offset at that midnight too.
 */
export function algiersDayStart(now: Date, daysAgo: number): Date {
	const { day, month, year } = algiersWallClockParts(now);
	const wallClockMidnightAsUtc = Date.UTC(year, month - 1, day - daysAgo);

	return new Date(wallClockMidnightAsUtc - algiersOffsetMs(now));
}

/** Zone offset of Africa/Algiers at `at`, in milliseconds (UTC+1 → 3_600_000). */
export function algiersOffsetMs(at: Date): number {
	const parts = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		timeZone: ALGIERS_TIME_ZONE,
		year: "numeric",
	}).formatToParts(at);
	const read = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);
	const wallClockAsUtc = Date.UTC(
		read("year"),
		read("month") - 1,
		read("day"),
		// "24" shows up for midnight in some ICU builds with hour12: false.
		read("hour") % 24,
		read("minute"),
		read("second"),
	);
	const truncatedNow = at.getTime() - (at.getTime() % 1_000);

	return wallClockAsUtc - truncatedNow;
}

function groupKey(row: LeadFunnelCountRow, groupBy: LeadFunnelGroupBy): string {
	if (row.key !== null && row.key !== "") {
		return row.key;
	}

	return groupBy === "campaign" ? NO_UTM_CAMPAIGN_KEY : "(unknown)";
}

function emptyCounts(): LeadFunnelCounts {
	return {
		cancelled: 0,
		confirmed: 0,
		delivered: 0,
		returned: 0,
		shipped: 0,
		to_confirm: 0,
		total: 0,
	};
}

/**
 * Totals from the ungrouped read: exactly one row (key null), or none when
 * the driver answers an empty set — then every count is 0.
 */
function totalsFromRows(rows: readonly LeadFunnelCountRow[]): LeadFunnelCounts {
	const [row] = rows;

	return row ? pickCounts(row) : emptyCounts();
}

function pickCounts(row: LeadFunnelCountRow): LeadFunnelCounts {
	return {
		cancelled: row.cancelled,
		confirmed: row.confirmed,
		delivered: row.delivered,
		returned: row.returned,
		shipped: row.shipped,
		to_confirm: row.to_confirm,
		total: row.total,
	};
}

export function buildLeadPerformanceNote(input: {
	groupBy: LeadFunnelGroupBy;
	groupsTruncated: boolean;
	windowDays: number;
}): string {
	const grouping =
		input.groupBy === "none"
			? "Totals only (no grouping)."
			: input.groupBy === "source"
				? "Groups by derived source: facebook (fbclid or a Facebook utm_source), tiktok (ttclid or a TikTok utm_source), else direct — the same badge the Leads tab shows."
				: input.groupBy === "campaign"
					? `Groups by the lead's utm_campaign (lower-cased, trimmed, max 200 chars); leads without one fall under "${NO_UTM_CAMPAIGN_KEY}".`
					: "Groups by lead status.";

	return [
		`Leads of this project only, captured in the window: ${input.windowDays} full Africa/Algiers days before today, plus today so far (from Algiers midnight ${input.windowDays} days ago to now); archived leads excluded.`,
		grouping,
		input.groupsTruncated
			? `Only the ${READ_LEAD_PERFORMANCE_GROUP_LIMIT} biggest groups are listed, so group counts may not add up to the totals.`
			: null,
		"Rates: confirmationRate = (confirmed + shipped + delivered + returned) / total — the share of ALL leads in the window that passed confirmation; to_confirm leads stay in the denominator, so a very recent window reads low until the calls are done. deliveryRate = delivered / (shipped + delivered + returned). returnRate = returned / (shipped + delivered + returned). A rate is null when its denominator is 0.",
		"These counts come from the Leads tab, which the merchant updates by hand: a stale status (e.g. everything still to_confirm) means the tab is behind, not that the ads failed. Platform numbers alone are never the COD truth.",
	]
		.filter((line): line is string => line !== null)
		.join(" ");
}

export function createReadLeadPerformanceTool(
	deps: ReadLeadPerformanceToolDeps,
): Tool<ReadLeadPerformanceInput, ReadLeadPerformanceOutput> {
	return tool({
		description:
			"Read the merchant's own lead funnel for this project from the Leads " +
			"tab (the backend truth): counts and confirmation / delivery / return " +
			"rates by source, campaign, or status over a window of N full " +
			"Africa/Algiers days before today, plus today so far. Call it " +
			"before any ads diagnosis or ROAS claim; platform numbers alone are " +
			"not the truth for COD.",
		inputSchema: readLeadPerformanceInputSchema,
		outputSchema: readLeadPerformanceOutputSchema,
		execute: async (input): Promise<ReadLeadPerformanceOutput> => {
			const windowDays = input.days ?? READ_LEAD_PERFORMANCE_DEFAULT_DAYS;
			const groupBy = input.groupBy ?? READ_LEAD_PERFORMANCE_DEFAULT_GROUP_BY;
			const now = deps.now ? deps.now() : new Date();
			const from = algiersDayStart(now, windowDays);
			const window = { from, to: now };
			// Totals always come from one ungrouped aggregate, so they never
			// depend on how many groups the grouped read returns or on the
			// repository's cap. The grouped read probes limit + 1 rows so a
			// 51st group reveals truncation without a count query.
			const [totalsRows, groupedRows] = await Promise.all([
				deps.leadsRepository.getFunnelCountsForProject(deps.projectId, {
					...window,
					groupBy: "none",
				}),
				groupBy === "none"
					? Promise.resolve<LeadFunnelCountRow[]>([])
					: deps.leadsRepository.getFunnelCountsForProject(deps.projectId, {
							...window,
							groupBy,
							limit: READ_LEAD_PERFORMANCE_GROUP_LIMIT + 1,
						}),
			]);
			const groupsTruncated =
				groupedRows.length > READ_LEAD_PERFORMANCE_GROUP_LIMIT;
			const listed = groupsTruncated
				? groupedRows.slice(0, READ_LEAD_PERFORMANCE_GROUP_LIMIT)
				: groupedRows;
			const totalsCounts = totalsFromRows(totalsRows);

			return {
				from: from.toISOString(),
				groups: listed.map((row) => ({
					key: groupKey(row, groupBy),
					...pickCounts(row),
				})),
				note: buildLeadPerformanceNote({
					groupBy,
					groupsTruncated,
					windowDays,
				}),
				to: now.toISOString(),
				totals: {
					...totalsCounts,
					...computeLeadFunnelRates(totalsCounts),
				},
				windowDays,
			};
		},
	});
}

export type ReadLeadPerformanceTool = ReturnType<
	typeof createReadLeadPerformanceTool
>;

export const readLeadPerformanceToolSchemaOnly: Tool<
	ReadLeadPerformanceInput,
	ReadLeadPerformanceOutput
> = tool({
	inputSchema: readLeadPerformanceInputSchema,
	outputSchema: readLeadPerformanceOutputSchema,
});
