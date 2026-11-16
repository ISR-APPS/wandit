// Week math of the schedule: the Monday of a week, its seven days, and the posts of each day.
// SchedulePage and its cards call these pure functions on the post list. The week starts on Monday.
import {
	type Post,
	type PostStatus,
	startOfDayAgo,
	startOfLocalDay,
} from "~/features/social";

/** The oldest week that the board can show: the post list covers 90 days, about 13 weeks. */
export const MIN_WEEK_OFFSET = -12;

/** The newest week that the board can show: the queue holds 13 days, so the next week is the last one. */
export const MAX_WEEK_OFFSET = 1;

/** A post with a day on the board. A draft has no time slot, so it never shows on the board. */
export type BoardPost = Post & {
	status: Exclude<PostStatus, "draft">;
	publishAt: string;
};

// The board shows a post only when it has a status and a time slot of the board.
function isBoardPost(post: Post): post is BoardPost {
	return post.status !== "draft" && post.publishAt !== null;
}

/** One day column of the board. */
export type WeekDay = {
	/** Local midnight of the day, in milliseconds since 1970. */
	start: number;
	/** True for the current day. */
	isToday: boolean;
	/** True for a day before the current day. An empty past day shows "Nothing posted". */
	isPast: boolean;
	/** The published, scheduled, and failed posts of the day, earliest first. Drafts have no day. */
	posts: BoardPost[];
};

/** Local midnight of the Monday of the week `offset` weeks after the current week. */
export function weekStart(now: number, offset: number): number {
	const todayStart = startOfLocalDay(now);
	// getDay() is 0 on Sunday. The week starts on Monday, so Sunday is 6 days after it.
	const daysSinceMonday = (new Date(todayStart).getDay() + 6) % 7;
	return startOfDayAgo(todayStart, daysSinceMonday - offset * 7);
}

/** The seven days of the week that starts at `start`, each with its posts. */
export function weekDays(posts: Post[], start: number, now: number): WeekDay[] {
	const todayStart = startOfLocalDay(now);
	return Array.from({ length: 7 }, (_, index) => {
		const dayStart = startOfDayAgo(start, -index);
		const dayEnd = startOfDayAgo(start, -index - 1);
		return {
			start: dayStart,
			isToday: dayStart === todayStart,
			isPast: dayStart < todayStart,
			posts: posts
				.filter(isBoardPost)
				.filter((post) => {
					const time = Date.parse(post.publishAt);
					return time >= dayStart && time < dayEnd;
				})
				.sort(
					(first, second) =>
						Date.parse(first.publishAt) - Date.parse(second.publishAt),
				),
		};
	});
}
