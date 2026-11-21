// Reads of the header alerts: the posts that the network refused and the drafts that wait too long for a slot.
// HeaderNotifications reads it after the shell renders. The failed posts are the rows of the "Failed" tab of Posts.
// The queryFn reads the sample history. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { channelProfile } from "../lib/channels";
import { buildSocialData } from "../lib/sample-data";
import { calendarDaysAgo } from "../lib/time";

// A draft older than this many days needs a time slot or a delete. The team plans one week ahead.
const STALE_DRAFT_DAYS = 5;

// Each alert opens the page of its post. linkOptions types the path, so a wrong path fails typecheck.
function postLink(postId: string) {
	return linkOptions({ to: "/app/posts/$postId", params: { postId } });
}

/** One alert of the bell menu. */
export type Alert = {
	/** The id of the post, for example "p-0142". */
	id: string;
	/** "failedPost": the network refused the post. "staleDraft": a draft with no slot for 5 days or more. */
	kind: "failedPost" | "staleDraft";
	/** The headline of the post. */
	title: string;
	/** The account name of the channel of the post. */
	detail: string;
	/** ISO time: the publish time of the failed post, or the creation time of the draft. */
	at: string;
	link: ReturnType<typeof postLink>;
};

/** Every alert, the oldest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const now = Date.now();
			const alerts: Alert[] = [];
			for (const post of buildSocialData(now).posts) {
				const isFailed = post.status === "failed" && post.publishAt !== null;
				const isStaleDraft =
					post.status === "draft" &&
					calendarDaysAgo(post.createdAt, now) >= STALE_DRAFT_DAYS;
				if (!isFailed && !isStaleDraft) {
					continue;
				}
				alerts.push({
					id: post.id,
					kind: isFailed ? "failedPost" : "staleDraft",
					title: post.title,
					detail: channelProfile(post.channelId).handle,
					at: isFailed && post.publishAt ? post.publishAt : post.createdAt,
					link: postLink(post.id),
				});
			}
			return alerts.sort((first, second) => first.at.localeCompare(second.at));
		},
	});
}
