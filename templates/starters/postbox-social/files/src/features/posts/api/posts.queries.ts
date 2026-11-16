// Reads of posts: the list (the last 90 days, the queue, and the drafts) and one post with its context.
// The list and detail routes prefetch them. The home, the schedule, and the channel page read the list too.
// Each queryFn reads the sample history of the social feature. A later turn replaces the body with a Supabase read.
import { queryOptions } from "@tanstack/react-query";
import {
	buildSocialData,
	LIST_DAYS,
	type Post,
	startOfDayAgo,
	startOfLocalDay,
} from "~/features/social";

// A post reaches its last impressions on its fourth day. Younger posts stay out of the channel average.
const COMPLETE_AGE_DAYS = 3;

// The post page lists this many other posts of the same pillar.
const RELATED_COUNT = 4;

/** One post with what its page compares it to. */
export type PostDetail = {
	post: Post;
	/** Averages of the published posts of the same channel in the last 90 days, complete posts only. */
	channelAverage: { impressions: number; engagementRate: number };
	/** The newest published posts of the same pillar on any channel, this post excluded. */
	related: Post[];
};

// The posts of the list window: published or failed from the start of the window, every scheduled post, every draft.
function listPosts(posts: Post[], now: number): Post[] {
	const windowStart = startOfDayAgo(startOfLocalDay(now), LIST_DAYS);
	return posts.filter(
		(post) =>
			post.publishAt === null || Date.parse(post.publishAt) >= windowStart,
	);
}

/** Every post of the list window, newest first: the queue at the top. The list page searches and pages them in the browser. */
export function postsQueryOptions() {
	return queryOptions({
		queryKey: ["posts", "list"],
		queryFn: async () => {
			const now = Date.now();
			return listPosts(buildSocialData(now).posts, now);
		},
	});
}

/** One post, or null when the id does not exist (an old link, or a typo in the URL). */
export function postQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["posts", "detail", id],
		queryFn: async (): Promise<PostDetail | null> => {
			const now = Date.now();
			const posts = listPosts(buildSocialData(now).posts, now);
			const post = posts.find((row) => row.id === id);
			if (!post) {
				return null;
			}
			const completeBefore = startOfDayAgo(
				startOfLocalDay(now),
				COMPLETE_AGE_DAYS,
			);
			const peers = posts.filter(
				(row) =>
					row.channelId === post.channelId &&
					row.status === "published" &&
					row.publishAt !== null &&
					Date.parse(row.publishAt) < completeBefore,
			);
			const peerImpressions = peers.reduce(
				(sum, row) => sum + row.impressions,
				0,
			);
			const peerEngagements = peers.reduce(
				(sum, row) => sum + row.engagements,
				0,
			);
			return {
				post,
				channelAverage: {
					impressions:
						peers.length === 0 ? 0 : Math.round(peerImpressions / peers.length),
					engagementRate:
						peerImpressions === 0 ? 0 : peerEngagements / peerImpressions,
				},
				related: posts
					.filter(
						(row) =>
							row.id !== post.id &&
							row.pillar === post.pillar &&
							row.status === "published",
					)
					.slice(0, RELATED_COUNT),
			};
		},
	});
}
