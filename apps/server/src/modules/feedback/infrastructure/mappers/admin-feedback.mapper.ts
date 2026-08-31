import {
	type AdminFeedbackActivity,
	type AdminFeedbackDetail,
	type AdminFeedbackSummary,
	type AdminUserPlan,
	billingPlanIds,
} from "@wandit/contracts";

import { feedbackTitle } from "../../domain/feedback-title";
import type {
	AdminFeedbackActivityRow,
	AdminFeedbackRow,
} from "../persistence/feedback.repository";

export function mapAdminFeedbackSummary(
	row: AdminFeedbackRow,
): AdminFeedbackSummary {
	return {
		id: row.id,
		title: feedbackTitle(row.message),
		message: row.message,
		category: row.category,
		status: row.status,
		priority: row.priority,
		createdAt: toIso(row.createdAt),
		updatedAt: toIso(row.updatedAt),
		resolvedAt: row.resolvedAt === null ? null : toIso(row.resolvedAt),
		reporter: {
			id: row.userId,
			name: row.reporterName,
			email: row.reporterEmail,
			image: row.reporterImage,
			plan: row.userId === null ? null : normalizePlan(row.reporterPlan),
			memberSince:
				row.userId === null || row.reporterCreatedAt === null
					? null
					: toIso(row.reporterCreatedAt),
		},
		context: {
			chatId: row.chatId,
			authSessionId: row.authSessionId,
			pageUrl: row.pageUrl,
			replayUrl: row.replayUrl,
			sentryEventId: row.sentryEventId,
			sentryEventAt:
				row.sentryEventAt === null ? null : toIso(row.sentryEventAt),
			userAgent: row.userAgent,
			viewport:
				row.viewportWidth === null || row.viewportHeight === null
					? null
					: { width: row.viewportWidth, height: row.viewportHeight },
			locale: row.locale,
		},
		project:
			row.projectId === null || row.projectName === null
				? null
				: { id: row.projectId, name: row.projectName },
		screenshotUrl: row.screenshotUrl,
		linear:
			row.linearIssueId === null
				? null
				: { issueId: row.linearIssueId, url: row.linearIssueUrl },
		adminNote: row.adminNote,
	};
}

export function mapAdminFeedbackDetail(
	row: AdminFeedbackRow,
	activityRows: AdminFeedbackActivityRow[],
): AdminFeedbackDetail {
	return {
		...mapAdminFeedbackSummary(row),
		activity: activityRows.map(mapAdminFeedbackActivity),
	};
}

export function mapAdminFeedbackActivity(
	row: AdminFeedbackActivityRow,
): AdminFeedbackActivity {
	return {
		id: row.id,
		kind: row.kind,
		fromValue: row.fromValue,
		toValue: row.toValue,
		actor:
			row.actorUserId === null || row.actorName === null
				? null
				: { id: row.actorUserId, name: row.actorName },
		createdAt: toIso(row.createdAt),
	};
}

// "free" is derived when the reporter has no entitled subscription row.
function normalizePlan(plan: string | null): AdminUserPlan {
	if (plan !== null && (billingPlanIds as readonly string[]).includes(plan)) {
		return plan as AdminUserPlan;
	}

	return "free";
}

// Raw SQL expressions can surface as Date or string depending on pg parsers.
function toIso(value: Date | string): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}
