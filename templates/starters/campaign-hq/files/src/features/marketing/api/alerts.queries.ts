// Reads of the header alerts: content that is not approved and goes out soon, and live flights that end soon.
// HeaderNotifications reads it after the shell renders. The soonest alert comes first.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { contentStatusOf } from "../lib/content";
import { DAY_MS, HOUR_MS } from "../lib/relative-time";
import { getSampleTables } from "../lib/sample-data";

// Each alert opens the page of its campaign. linkOptions types the path, so a wrong path fails typecheck.
function campaignLink(campaignId: string) {
	return linkOptions({
		to: "/app/campaigns/$campaignId",
		params: { campaignId },
	});
}

// A draft or an item in review that goes out within 48 hours needs an approval now.
const REVIEW_WINDOW_MS = 48 * HOUR_MS;

// A live flight that ends within 3 days needs a decision: extend it, or prepare the report.
const ENDING_WINDOW_MS = 3 * DAY_MS;

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "reviewDue": content not yet scheduled that goes out soon. "endingSoon": a live campaign near its last day. */
	kind: "reviewDue" | "endingSoon";
	/** The content title or the campaign name. */
	title: string;
	/** The campaign name of the content, or the client of the campaign. */
	detail: string;
	/** ISO time: when the content goes out, or when the flight ends. */
	at: string;
	link: ReturnType<typeof campaignLink>;
};

/** Every alert, the soonest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const tables = getSampleTables();
			const now = Date.now();
			const campaigns = new Map(
				tables.campaigns.map((campaign) => [campaign.id, campaign]),
			);
			const reviewDue: Alert[] = tables.contentItems
				.filter((item) => {
					const status = contentStatusOf(item.scheduledAt, item.stage, now);
					const goesOutIn = Date.parse(item.scheduledAt) - now;
					return (
						(status === "drafting" || status === "in_review") &&
						goesOutIn <= REVIEW_WINDOW_MS
					);
				})
				.map((item) => ({
					id: item.id,
					kind: "reviewDue",
					title: item.title,
					detail: campaigns.get(item.campaignId)?.name ?? "",
					at: item.scheduledAt,
					link: campaignLink(item.campaignId),
				}));
			const endingSoon: Alert[] = tables.campaigns
				.filter(
					(campaign) =>
						campaign.status === "live" &&
						Date.parse(campaign.endAt) - now <= ENDING_WINDOW_MS,
				)
				.map((campaign) => ({
					id: campaign.id,
					kind: "endingSoon",
					title: campaign.name,
					detail: campaign.client,
					at: campaign.endAt,
					link: campaignLink(campaign.id),
				}));
			return [...reviewDue, ...endingSoon].sort((first, second) =>
				first.at.localeCompare(second.at),
			);
		},
	});
}
