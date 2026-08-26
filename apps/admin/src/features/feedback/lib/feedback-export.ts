import type {
	FeedbackItem,
	ListFeedbackParams,
} from "@/features/feedback/api/feedback.dto";
import { listFeedback } from "@/features/feedback/api/feedback.services";

export const FEEDBACK_EXPORT_PAGE_SIZE = 100;

export type FeedbackExportFilters = Omit<
	ListFeedbackParams,
	"page" | "pageSize"
>;

type FetchFeedbackPage = typeof listFeedback;

export async function fetchAllFilteredFeedback(
	filters: FeedbackExportFilters,
	fetchPage: FetchFeedbackPage = listFeedback,
): Promise<FeedbackItem[]> {
	const feedback: FeedbackItem[] = [];
	let page = 1;
	let total = Number.POSITIVE_INFINITY;

	while (feedback.length < total) {
		const result = await fetchPage({
			...filters,
			page,
			pageSize: FEEDBACK_EXPORT_PAGE_SIZE,
		});

		total = result.total;
		if (result.items.length === 0) {
			break;
		}

		feedback.push(...result.items);
		page += 1;
	}

	return feedback;
}

const FEEDBACK_EXPORT_HEADERS = [
	"id",
	"createdAt",
	"status",
	"priority",
	"category",
	"reporterName",
	"reporterEmail",
	"plan",
	"title",
	"message",
	"pageUrl",
	"project",
	"linearIssueId",
	"linearIssueUrl",
	"screenshotUrl",
] as const;

function quoteCsvCell(value: string): string {
	const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

	return /[",\r\n]/.test(safeValue)
		? `"${safeValue.replaceAll('"', '""')}"`
		: safeValue;
}

export function buildFeedbackCsv(rows: FeedbackItem[]): string {
	const lines = [FEEDBACK_EXPORT_HEADERS.join(",")];

	for (const item of rows) {
		lines.push(
			[
				item.id,
				item.createdAt,
				item.status,
				item.priority,
				item.category ?? "",
				item.reporter.name,
				item.reporter.email,
				item.reporter.plan ?? "",
				item.title,
				item.message,
				item.context.pageUrl,
				item.project?.name ?? "",
				item.linear?.issueId ?? "",
				item.linear?.url ?? "",
				item.screenshotUrl ?? "",
			]
				.map(quoteCsvCell)
				.join(","),
		);
	}

	return `${lines.join("\r\n")}\r\n`;
}

export function feedbackExportFileName(now = new Date()): string {
	return `feedback-${now.toISOString().slice(0, 10)}.csv`;
}

export async function exportFeedbackToCsv(
	filters: FeedbackExportFilters,
): Promise<void> {
	const feedback = await fetchAllFilteredFeedback(filters);
	const blob = new Blob([buildFeedbackCsv(feedback)], {
		type: "text/csv;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);

	try {
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = feedbackExportFileName();
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
	} finally {
		URL.revokeObjectURL(url);
	}
}
