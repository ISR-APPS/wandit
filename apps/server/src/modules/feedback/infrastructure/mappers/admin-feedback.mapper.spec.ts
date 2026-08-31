import { describe, expect, it } from "vitest";

import type {
	AdminFeedbackActivityRow,
	AdminFeedbackRow,
} from "../persistence/feedback.repository";
import {
	mapAdminFeedbackActivity,
	mapAdminFeedbackDetail,
	mapAdminFeedbackSummary,
} from "./admin-feedback.mapper";

const FEEDBACK_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const ROW: AdminFeedbackRow = {
	id: FEEDBACK_ID,
	userId: "user-1",
	chatId: "44444444-4444-4444-8444-444444444444",
	authSessionId: "session-1",
	reporterName: "Ada Lovelace",
	reporterEmail: "ada@example.com",
	projectId: PROJECT_ID,
	category: "bug",
	message: "  The   publish button\nfreezes  ",
	pageUrl: `https://app.example.com/p/${PROJECT_ID}`,
	replayUrl: "https://replay.example.com/1",
	sentryEventId: "event-1",
	sentryEventAt: new Date("2026-08-20T09:00:00.000Z"),
	userAgent: "Browser/1",
	viewportWidth: 1512,
	viewportHeight: 982,
	locale: "en-US",
	screenshotUrl: "https://assets.example.com/screenshot.png",
	linearIssueId: "ISRECOM-123",
	linearIssueUrl: "https://linear.app/issue/ISRECOM-123",
	status: "reviewing",
	priority: "high",
	adminNote: "Check the deployment logs.",
	resolvedAt: null,
	createdAt: new Date("2026-08-20T10:00:00.000Z"),
	updatedAt: new Date("2026-08-21T11:00:00.000Z"),
	reporterImage: "https://assets.example.com/avatar.png",
	reporterCreatedAt: new Date("2025-09-01T00:00:00.000Z"),
	reporterPlan: "business",
	projectName: "Launch page",
};

const ACTIVITY: AdminFeedbackActivityRow = {
	id: "33333333-3333-4333-8333-333333333333",
	feedbackId: FEEDBACK_ID,
	kind: "status_changed",
	fromValue: "new",
	toValue: "reviewing",
	actorUserId: "admin-1",
	createdAt: new Date("2026-08-21T11:00:00.000Z"),
	actorName: "Grace Hopper",
};

describe("admin feedback mapper", () => {
	it("maps joined context and derives the reporter plan and title", () => {
		const summary = mapAdminFeedbackSummary(ROW);

		expect(summary).toMatchObject({
			id: FEEDBACK_ID,
			title: "The publish button freezes",
			reporter: {
				id: "user-1",
				plan: "business",
				memberSince: "2025-09-01T00:00:00.000Z",
			},
			context: {
				chatId: "44444444-4444-4444-8444-444444444444",
				authSessionId: "session-1",
				sentryEventAt: "2026-08-20T09:00:00.000Z",
				viewport: { width: 1512, height: 982 },
			},
			project: { id: PROJECT_ID, name: "Launch page" },
			linear: {
				issueId: "ISRECOM-123",
				url: "https://linear.app/issue/ISRECOM-123",
			},
		});
	});

	it("keeps deleted reporters readable without inventing live account data", () => {
		const summary = mapAdminFeedbackSummary({
			...ROW,
			userId: null,
			reporterImage: null,
			reporterPlan: "business",
			projectName: null,
			viewportHeight: null,
			linearIssueId: null,
		});

		expect(summary.reporter).toMatchObject({
			id: null,
			name: "Ada Lovelace",
			email: "ada@example.com",
			plan: null,
			memberSince: null,
		});
		expect(summary.project).toBeNull();
		expect(summary.context.viewport).toBeNull();
		expect(summary.linear).toBeNull();
	});

	it("maps activity actors and includes the trail in details", () => {
		expect(mapAdminFeedbackActivity(ACTIVITY)).toEqual({
			id: ACTIVITY.id,
			kind: "status_changed",
			fromValue: "new",
			toValue: "reviewing",
			actor: { id: "admin-1", name: "Grace Hopper" },
			createdAt: "2026-08-21T11:00:00.000Z",
		});
		expect(mapAdminFeedbackDetail(ROW, [ACTIVITY]).activity).toHaveLength(1);
		expect(
			mapAdminFeedbackActivity({
				...ACTIVITY,
				actorUserId: null,
				actorName: null,
			}),
		).toMatchObject({ actor: null });
	});
});
