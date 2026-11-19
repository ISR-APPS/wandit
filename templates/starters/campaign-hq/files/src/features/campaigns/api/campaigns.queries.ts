// Reads of campaigns: the list with lifetime results and team, and one campaign with its channels, timeline, and content.
// The route loaders prefetch them. The campaign pages and the home panels read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type AudienceType,
	type CampaignEventKind,
	type CampaignObjective,
	type CampaignStatus,
	type Channel,
	type ChannelPoint,
	type ContentFormat,
	type ContentStatus,
	calendarDaysFromNow,
	channelPoints,
	contentStatusOf,
	getSampleTables,
	type MediaTotals,
	memberName,
	type SampleTables,
	totalsBetween,
	totalsByChannel,
} from "~/features/marketing";
import { type Pacing, pacingOf } from "../lib/pacing";

/** One campaign with its lifetime results. The times are ISO texts. */
export type Campaign = {
	/** For example "cmp-118". Also the `$campaignId` of the detail route. */
	id: string;
	/** The code of briefs and reports, for example "CMP-118". */
	code: string;
	name: string;
	/** The client brand that pays for the campaign. */
	client: string;
	objective: CampaignObjective;
	status: CampaignStatus;
	startAt: string;
	endAt: string;
	/** When the team paused the campaign, or null. */
	pausedAt: string | null;
	/** The approved budget of the whole flight, in whole units of CURRENCY. */
	budget: number;
	/** The channels of the media plan, in chart order. */
	channels: Channel[];
	ownerName: string;
	/** The owner first, then each other person who owns a content item of the campaign. At most 4 names. */
	team: string[];
	/** The days of the flight, the first and the last day included. */
	flightDays: number;
	/** The days of the flight before today: 0 before the start, flightDays after the end. */
	elapsedDays: number;
	/** Spend and results from the start to yesterday. */
	totals: MediaTotals;
	/** Spend against the plan of the days so far. Only a live campaign has a pace. */
	pacing: Pacing | null;
};

/** One audience of a campaign, with the facts that its row shows. */
export type CampaignAudience = {
	id: string;
	name: string;
	type: AudienceType;
	/** People in the segment today. */
	size: number;
};

/** One event of a campaign timeline, newest first in a list. */
export type CampaignEvent = {
	id: string;
	campaignId: string;
	kind: CampaignEventKind;
	occurredAt: string;
	actorName: string;
	/** The audience name of an "audience_added" event, else null. */
	audienceName: string | null;
};

/** One calendar item of a campaign, with its status at the time of the read. */
export type CampaignContent = {
	id: string;
	title: string;
	format: ContentFormat;
	scheduledAt: string;
	status: ContentStatus;
	ownerName: string;
};

/** One campaign with the records that only its own page shows. */
export type CampaignDetail = Campaign & {
	/** One sentence of the brief. */
	brief: string;
	ownerRole: string;
	audiences: CampaignAudience[];
	/** The results of each channel of the plan, in chart order. */
	byChannel: { channel: Channel; totals: MediaTotals }[];
	/** Spend per day and channel, over the last 90 days of the flight at most. Empty before the start. */
	dailySpend: ChannelPoint[];
	/** Every event of the campaign, newest first. */
	events: CampaignEvent[];
	/** Every calendar item of the campaign, oldest first. */
	content: CampaignContent[];
};

// The spend chart of a campaign shows at most the 90 newest days of its flight.
const DETAIL_CHART_DAYS = 90;

// A campaign card shows at most 4 avatars, as the kit project cards.
const TEAM_SIZE = 4;

function toCampaign(
	tables: SampleTables,
	row: SampleTables["campaigns"][number],
): Campaign {
	const rows = tables.channelDays.filter((day) => day.campaignId === row.id);
	const startOffset = calendarDaysFromNow(row.startAt, tables.dayStart);
	const endOffset = calendarDaysFromNow(row.endAt, tables.dayStart);
	const flightDays = endOffset - startOffset + 1;
	// Today does not count: its results arrive tomorrow.
	const elapsedDays = Math.min(flightDays, Math.max(0, -startOffset));
	const totals = totalsBetween(rows, Number.NEGATIVE_INFINITY, -1);
	const teamIds = new Set([
		row.ownerId,
		...tables.contentItems
			.filter((item) => item.campaignId === row.id)
			.map((item) => item.ownerId),
	]);
	return {
		id: row.id,
		code: row.code,
		name: row.name,
		client: row.client,
		objective: row.objective,
		status: row.status,
		startAt: row.startAt,
		endAt: row.endAt,
		pausedAt: row.pausedAt,
		budget: row.budget,
		channels: row.channels,
		ownerName: memberName(tables, row.ownerId),
		team: [...teamIds]
			.slice(0, TEAM_SIZE)
			.map((memberId) => memberName(tables, memberId)),
		flightDays,
		elapsedDays,
		totals,
		pacing:
			row.status === "live"
				? pacingOf(totals.spend, row.budget, elapsedDays, flightDays)
				: null,
	};
}

function toEvent(
	tables: SampleTables,
	row: SampleTables["campaignEvents"][number],
): CampaignEvent {
	return {
		id: row.id,
		campaignId: row.campaignId,
		kind: row.kind,
		occurredAt: row.occurredAt,
		actorName: memberName(tables, row.actorId),
		audienceName:
			row.audienceId === null
				? null
				: (tables.audiences.find((audience) => audience.id === row.audienceId)
						?.name ?? null),
	};
}

/** Every campaign, the newest flight first. The list page filters, searches, and pages them in the browser. */
export function campaignsQueryOptions() {
	return queryOptions({
		queryKey: ["campaigns", "list"],
		queryFn: async (): Promise<Campaign[]> => {
			const tables = getSampleTables();
			return tables.campaigns
				.map((row) => toCampaign(tables, row))
				.sort(
					(first, second) =>
						Date.parse(second.startAt) - Date.parse(first.startAt),
				);
		},
	});
}

/** One campaign with its channels, spend per day, audiences, timeline, and content. null for an unknown id. */
export function campaignQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["campaigns", "detail", id],
		queryFn: async (): Promise<CampaignDetail | null> => {
			const tables = getSampleTables();
			const row = tables.campaigns.find((campaign) => campaign.id === id);
			if (!row) {
				return null;
			}
			const campaign = toCampaign(tables, row);
			const rows = tables.channelDays.filter((day) => day.campaignId === id);
			const byChannel = totalsByChannel(rows);
			const lastOffset = rows.reduce(
				(last, day) => Math.max(last, day.dayOffset),
				Number.NEGATIVE_INFINITY,
			);
			const firstOffset = Math.max(
				calendarDaysFromNow(row.startAt, tables.dayStart),
				lastOffset - DETAIL_CHART_DAYS + 1,
			);
			const owner = tables.team.find((member) => member.id === row.ownerId);
			const now = Date.now();
			return {
				...campaign,
				brief: row.brief,
				ownerRole: owner?.role ?? "",
				audiences: tables.audiences
					.filter((audience) => row.audienceIds.includes(audience.id))
					.map((audience) => ({
						id: audience.id,
						name: audience.name,
						type: audience.type,
						size: audience.sizeByDay.at(-1) ?? 0,
					})),
				byChannel: row.channels.map((channel) => ({
					channel,
					totals: byChannel[channel],
				})),
				// No row yet (a planned campaign): no chart.
				dailySpend:
					rows.length === 0
						? []
						: channelPoints(
								rows,
								tables.dayStart,
								firstOffset,
								lastOffset,
								(day) => day.spend,
							).filter((point) => row.channels.includes(point.channel)),
				events: tables.campaignEvents
					.filter((event) => event.campaignId === id)
					.map((event) => toEvent(tables, event))
					.reverse(),
				content: tables.contentItems
					.filter((item) => item.campaignId === id)
					.map((item) => ({
						id: item.id,
						title: item.title,
						format: item.format,
						scheduledAt: item.scheduledAt,
						status: contentStatusOf(item.scheduledAt, item.stage, now),
						ownerName: memberName(tables, item.ownerId),
					})),
			};
		},
	});
}
