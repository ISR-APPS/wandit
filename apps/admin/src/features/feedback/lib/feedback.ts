import type {
	FeedbackItem,
	FeedbackPriority,
	FeedbackSort,
	FeedbackStatusFilter,
	FeedbackTypeFilter,
} from "@/features/feedback/types";

export const FEEDBACK_STATUS_OPTIONS: Array<{
	value: FeedbackStatusFilter;
	label: string;
}> = [
	{ value: "all", label: "Inbox" },
	{ value: "new", label: "New" },
	{ value: "reviewing", label: "Reviewing" },
	{ value: "planned", label: "Planned" },
	{ value: "resolved", label: "Resolved" },
];

export const FEEDBACK_TYPE_OPTIONS: Array<{
	value: FeedbackTypeFilter;
	label: string;
}> = [
	{ value: "all", label: "All types" },
	{ value: "bug", label: "Bug reports" },
	{ value: "idea", label: "Ideas" },
	{ value: "experience", label: "Experience" },
	{ value: "praise", label: "Praise" },
];

export const FEEDBACK_SORT_OPTIONS: Array<{
	value: FeedbackSort;
	label: string;
}> = [
	{ value: "newest", label: "Newest first" },
	{ value: "oldest", label: "Oldest first" },
	{ value: "priority", label: "Highest priority" },
];

const PRIORITY_RANK: Record<FeedbackPriority, number> = {
	urgent: 4,
	high: 3,
	medium: 2,
	low: 1,
};

// The inbox is intentionally backed by a fixed mock snapshot. Keeping its
// relative labels anchored to the same snapshot makes demos deterministic.
const MOCK_FEEDBACK_NOW_MS = Date.parse("2026-07-30T09:06:00.000Z");
const feedbackDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
	month: "short",
	year: "numeric",
});
const feedbackShortDateFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
});

export function filterFeedback(
	items: FeedbackItem[],
	options: {
		query: string;
		status: FeedbackStatusFilter;
		type: FeedbackTypeFilter;
		sort: FeedbackSort;
	},
): FeedbackItem[] {
	const normalizedQuery = options.query.trim().toLocaleLowerCase();

	const filtered = items.filter((item) => {
		if (options.status !== "all" && item.status !== options.status) {
			return false;
		}

		if (options.type !== "all" && item.type !== options.type) {
			return false;
		}

		if (!normalizedQuery) {
			return true;
		}

		return [
			item.id,
			item.title,
			item.message,
			item.reporter.name,
			item.reporter.email,
			item.context.project,
			...item.tags,
		]
			.join(" ")
			.toLocaleLowerCase()
			.includes(normalizedQuery);
	});

	return filtered.toSorted((first, second) => {
		if (options.sort === "priority") {
			const priorityDifference =
				PRIORITY_RANK[second.priority] - PRIORITY_RANK[first.priority];

			if (priorityDifference !== 0) {
				return priorityDifference;
			}
		}

		const dateDifference =
			Date.parse(second.createdAt) - Date.parse(first.createdAt);

		return options.sort === "oldest" ? -dateDifference : dateDifference;
	});
}

export function countFeedbackByStatus(
	items: FeedbackItem[],
	status: FeedbackStatusFilter,
): number {
	return status === "all"
		? items.length
		: items.filter((item) => item.status === status).length;
}

export function titleCaseFeedbackValue(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getFeedbackInitials(name: string): string {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part.charAt(0))
		.join("")
		.toLocaleUpperCase();
}

export function formatFeedbackDateTime(value: string): string {
	return feedbackDateTimeFormatter.format(new Date(value));
}

export function formatFeedbackRelativeTime(value: string): string {
	const elapsedMs = MOCK_FEEDBACK_NOW_MS - Date.parse(value);
	const elapsedMinutes = Math.max(Math.floor(elapsedMs / 60_000), 0);

	if (elapsedMinutes < 1) {
		return "Just now";
	}

	if (elapsedMinutes < 60) {
		return `${elapsedMinutes}m ago`;
	}

	const elapsedHours = Math.floor(elapsedMinutes / 60);
	if (elapsedHours < 24) {
		return `${elapsedHours}h ago`;
	}

	const elapsedDays = Math.floor(elapsedHours / 24);
	if (elapsedDays < 7) {
		return `${elapsedDays}d ago`;
	}

	return feedbackShortDateFormatter.format(new Date(value));
}
