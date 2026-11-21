// Reads of audiences: every segment with its size history and the campaigns that target it.
// The /app/audiences loader prefetches it. The audience table and the audience panel read it from the cache.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type AudienceType,
	type CampaignStatus,
	changeRatio,
	getSampleTables,
} from "~/features/marketing";

/** One campaign that targets an audience. */
export type AudienceCampaign = {
	id: string;
	name: string;
	status: CampaignStatus;
};

/** One audience segment with the facts of its row and its panel. */
export type Audience = {
	/** For example "aud-07". The panel opens with `?audience=<id>`. */
	id: string;
	name: string;
	/** The client brand of the segment. */
	client: string;
	type: AudienceType;
	/** How the platform builds the segment, in one sentence. */
	definition: string;
	/** People in the segment today. */
	size: number;
	/** Change of size against 30 days ago: 0.06 is +6 %. null when the size was 0. */
	growth: number | null;
	/** People in the segment for each of the last 90 days, oldest first. */
	sizeByDay: number[];
	/** Share of reached people who clicked, saved, or replied in the last 30 days: 0.034 is 3.4 %. */
	engagementRate: number;
	/** The campaigns that target the segment, the newest flight first. */
	campaigns: AudienceCampaign[];
};

// The growth compares today with the same segment this many days ago.
const GROWTH_DAYS = 30;

/** Every audience, grouped by client in the order of the sample table. */
export function audiencesQueryOptions() {
	return queryOptions({
		queryKey: ["audiences", "list"],
		queryFn: async (): Promise<Audience[]> => {
			const tables = getSampleTables();
			const campaignsNewestFirst = [...tables.campaigns].sort(
				(first, second) =>
					Date.parse(second.startAt) - Date.parse(first.startAt),
			);
			return tables.audiences.map((row) => {
				const size = row.sizeByDay.at(-1) ?? 0;
				const before = row.sizeByDay.at(-1 - GROWTH_DAYS) ?? 0;
				return {
					id: row.id,
					name: row.name,
					client: row.client,
					type: row.type,
					definition: row.definition,
					size,
					growth: changeRatio(size, before),
					sizeByDay: row.sizeByDay,
					engagementRate: row.engagementRate,
					campaigns: campaignsNewestFirst
						.filter((campaign) => campaign.audienceIds.includes(row.id))
						.map((campaign) => ({
							id: campaign.id,
							name: campaign.name,
							status: campaign.status,
						})),
				};
			});
		},
	});
}
