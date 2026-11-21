// Month math of the schedule: the 6 x 7 days of a month view and the posts of each day.
// SchedulePage calls these pure functions on the post list. The week starts on Monday, as on the rest of the app.
import { type Post, startOfDayAgo, startOfLocalDay } from "~/features/social";

/** A post with a time slot. A draft has no slot, so it never shows on the calendar. */
export type SlotPost = Post & { publishAt: string };

/** One cell of the month view. */
export type MonthDay = {
	/** Local midnight of the day, in milliseconds since 1970. Also the React key. */
	start: number;
	/** False for the leading and trailing days of the next and previous months. */
	inMonth: boolean;
	isToday: boolean;
	/** The posts of the day with a slot, earliest first. */
	posts: SlotPost[];
};

// The calendar shows a post only when it has a time slot.
function hasSlot(post: Post): post is SlotPost {
	return post.publishAt !== null;
}

/** Local midnight of the first day of the month `offset` months after the month of `now`. */
export function monthStart(now: number, offset: number): number {
	const date = new Date(startOfLocalDay(now));
	return new Date(date.getFullYear(), date.getMonth() + offset, 1).getTime();
}

/** The 42 days of the month view of the month that starts at `start`: 6 weeks, Monday first. */
export function monthDays(
	posts: Post[],
	start: number,
	now: number,
): MonthDay[] {
	const todayStart = startOfLocalDay(now);
	const month = new Date(start).getMonth();
	// getDay() is 0 on Sunday. The grid starts on Monday, so Sunday is 6 days after it.
	const leadingDays = (new Date(start).getDay() + 6) % 7;
	const gridStart = startOfDayAgo(start, leadingDays);
	const slotted = posts
		.filter(hasSlot)
		.sort(
			(first, second) =>
				Date.parse(first.publishAt) - Date.parse(second.publishAt),
		);
	return Array.from({ length: 42 }, (_, index) => {
		const dayStart = startOfDayAgo(gridStart, -index);
		const dayEnd = startOfDayAgo(gridStart, -index - 1);
		return {
			start: dayStart,
			inMonth: new Date(dayStart).getMonth() === month,
			isToday: dayStart === todayStart,
			posts: slotted.filter((post) => {
				const time = Date.parse(post.publishAt);
				return time >= dayStart && time < dayEnd;
			}),
		};
	});
}
