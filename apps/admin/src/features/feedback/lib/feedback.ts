import type { FeedbackStats } from "@/features/feedback/api/feedback.dto";
import type {
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
	{ value: "other", label: "Other" },
];

export const FEEDBACK_SORT_OPTIONS: Array<{
	value: FeedbackSort;
	label: string;
}> = [
	{ value: "newest", label: "Newest first" },
	{ value: "oldest", label: "Oldest first" },
	{ value: "priority", label: "Highest priority" },
];

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
const feedbackMemberSinceFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	year: "numeric",
});

export function countFeedbackByStatus(
	stats: FeedbackStats | undefined,
	status: FeedbackStatusFilter,
): number {
	if (!stats) {
		return 0;
	}

	return status === "all" ? stats.total : stats.byStatus[status];
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

export function formatFeedbackMemberSince(value: string): string {
	return feedbackMemberSinceFormatter.format(new Date(value));
}

export function formatFeedbackRelativeTime(
	value: string,
	nowMs = Date.now(),
): string {
	const elapsedMs = nowMs - Date.parse(value);
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
