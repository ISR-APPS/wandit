// Reads of the content calendar: every item with its campaign, its channel, and its status at the time of the read.
// The /app/calendar loader prefetches it. The month grid, the agenda, the rail, and the item dialog read it from the cache.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type Channel,
	CONTENT_FORMAT_CHANNEL,
	type ContentFormat,
	type ContentStatus,
	contentStatusOf,
	getSampleTables,
	memberName,
} from "~/features/marketing";

/** One calendar item, ready for a cell, a row, or the dialog. */
export type ContentItem = {
	/** For example "cnt-042". */
	id: string;
	title: string;
	format: ContentFormat;
	/** The channel of the format. The chip takes its color. */
	channel: Channel;
	campaignId: string;
	campaignName: string;
	client: string;
	/** When the item goes out, as ISO. */
	scheduledAt: string;
	/** Published once its time has passed, else its planned stage. */
	status: ContentStatus;
	ownerName: string;
};

/** Every item of the calendar window (6 weeks back, 6 weeks ahead), oldest first. */
export function contentItemsQueryOptions() {
	return queryOptions({
		queryKey: ["content", "list"],
		queryFn: async (): Promise<ContentItem[]> => {
			const tables = getSampleTables();
			const now = Date.now();
			return tables.contentItems.flatMap((item) => {
				const campaign = tables.campaigns.find(
					(row) => row.id === item.campaignId,
				);
				if (!campaign) {
					return [];
				}
				return [
					{
						id: item.id,
						title: item.title,
						format: item.format,
						channel: CONTENT_FORMAT_CHANNEL[item.format],
						campaignId: campaign.id,
						campaignName: campaign.name,
						client: campaign.client,
						scheduledAt: item.scheduledAt,
						status: contentStatusOf(item.scheduledAt, item.stage, now),
						ownerName: memberName(tables, item.ownerId),
					},
				];
			});
		},
	});
}
