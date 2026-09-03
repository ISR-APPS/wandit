import { Logger, NotFoundException } from "@nestjs/common";
import {
	type AdminListFeedbackQuery,
	adminFeedbackDetailSchema,
	adminFeedbackStatsSchema,
	adminListFeedbackResponseSchema,
} from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	deleteObject,
	isR2Configured,
	publicAssetKeyFromUrl,
} from "../../../../infrastructure/storage/r2";
import type {
	AdminFeedbackActivityRow,
	AdminFeedbackRow,
	AdminFeedbackStatsRow,
	AdminFeedbackUpdatePatch,
	FeedbackActivityInsert,
	FeedbackRepository,
} from "../../infrastructure/persistence/feedback.repository";
import { FeedbackAdminService } from "./feedback-admin.service";

vi.mock("../../../../infrastructure/storage/r2", () => ({
	deleteObject: vi.fn(),
	isR2Configured: vi.fn(),
	publicAssetKeyFromUrl: vi.fn(),
}));

const FEEDBACK_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-25T10:20:30.000Z");

function feedbackRow(
	overrides: Partial<AdminFeedbackRow> = {},
): AdminFeedbackRow {
	return {
		id: FEEDBACK_ID,
		userId: "user_1",
		chatId: null,
		authSessionId: "session-1",
		reporterName: "Amina Doe",
		reporterEmail: "amina@example.com",
		projectId: null,
		category: "bug",
		message: "The publish button does not respond.",
		pageUrl: "https://app.example.test/dashboard",
		replayUrl: null,
		sentryEventId: null,
		sentryEventAt: null,
		userAgent: null,
		viewportWidth: null,
		viewportHeight: null,
		locale: "en",
		screenshotUrl: null,
		linearIssueId: null,
		linearIssueUrl: null,
		status: "new",
		priority: "medium",
		adminNote: "",
		resolvedAt: null,
		createdAt: new Date("2026-08-20T08:00:00.000Z"),
		updatedAt: new Date("2026-08-20T08:00:00.000Z"),
		reporterImage: null,
		reporterCreatedAt: new Date("2026-01-02T12:00:00.000Z"),
		reporterPlan: null,
		projectName: null,
		...overrides,
	};
}

class FakeFeedbackRepository {
	row: AdminFeedbackRow | null = feedbackRow();
	activity: AdminFeedbackActivityRow[] = [];
	stats: AdminFeedbackStatsRow = {
		total: 4,
		byStatus: { new: 1, reviewing: 1, planned: 1, resolved: 1 },
		openBugs: 2,
		highPriorityOpen: 1,
		resolvedLast7Days: 1,
	};

	readonly adminFindById = vi.fn(async (feedbackId: string) =>
		this.row?.id === feedbackId ? this.row : null,
	);
	readonly listActivity = vi.fn(async () => this.activity);
	readonly adminStats = vi.fn(async () => this.stats);
	readonly adminList = vi.fn(async (query: AdminListFeedbackQuery) => ({
		items: this.row ? [this.row] : [],
		page: query.page,
		pageSize: query.pageSize,
		total: this.row ? 1 : 0,
	}));
	readonly adminUpdate = vi.fn(
		async (
			feedbackId: string,
			patch: AdminFeedbackUpdatePatch,
			_activities: FeedbackActivityInsert[],
		) => {
			if (this.row?.id === feedbackId) {
				this.row = { ...this.row, ...patch, updatedAt: NOW };
			}
		},
	);
	readonly delete = vi.fn(async (feedbackId: string) => {
		if (this.row?.id !== feedbackId) {
			return false;
		}

		this.row = null;

		return true;
	});
}

function setup(row: AdminFeedbackRow | null = feedbackRow()) {
	const repository = new FakeFeedbackRepository();
	repository.row = row;
	const service = new FeedbackAdminService(
		repository as unknown as FeedbackRepository,
	);

	return { repository, service };
}

describe("FeedbackAdminService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(deleteObject).mockReset().mockResolvedValue(undefined);
		vi.mocked(isR2Configured).mockReset().mockReturnValue(true);
		vi.mocked(publicAssetKeyFromUrl)
			.mockReset()
			.mockReturnValue(`feedback/${FEEDBACK_ID}/screenshot.png`);
		vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
		vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("maps list, detail, and stats responses to their contracts", async () => {
		const { repository, service } = setup();
		const query = {
			page: 1,
			pageSize: 20,
			sort: "newest",
		} satisfies AdminListFeedbackQuery;

		const [list, detail, stats] = await Promise.all([
			service.list(query),
			service.get(FEEDBACK_ID),
			service.stats(),
		]);

		expect(repository.adminList).toHaveBeenCalledWith(query);
		expect(adminListFeedbackResponseSchema.parse(list)).toEqual(list);
		expect(adminFeedbackDetailSchema.parse(detail)).toEqual(detail);
		expect(adminFeedbackStatsSchema.parse(stats)).toEqual(stats);
	});

	it("writes one activity for each changed field and never copies note text into the trail", async () => {
		const { repository, service } = setup();

		const updated = await service.update(
			FEEDBACK_ID,
			{
				status: "resolved",
				priority: "high",
				adminNote: "Ask the reporter for a replay.",
			},
			"admin_1",
		);

		expect(repository.adminUpdate).toHaveBeenCalledWith(
			FEEDBACK_ID,
			{
				status: "resolved",
				priority: "high",
				adminNote: "Ask the reporter for a replay.",
				resolvedAt: NOW,
			},
			[
				{
					feedbackId: FEEDBACK_ID,
					kind: "status_changed",
					fromValue: "new",
					toValue: "resolved",
					actorUserId: "admin_1",
				},
				{
					feedbackId: FEEDBACK_ID,
					kind: "priority_changed",
					fromValue: "medium",
					toValue: "high",
					actorUserId: "admin_1",
				},
				{
					feedbackId: FEEDBACK_ID,
					kind: "note_updated",
					fromValue: null,
					toValue: null,
					actorUserId: "admin_1",
				},
			],
		);
		expect(updated).toMatchObject({
			status: "resolved",
			priority: "high",
			adminNote: "Ask the reporter for a replay.",
			resolvedAt: NOW.toISOString(),
		});
	});

	it("clears resolvedAt when feedback leaves resolved", async () => {
		const { repository, service } = setup(
			feedbackRow({
				status: "resolved",
				resolvedAt: new Date("2026-08-24T09:00:00.000Z"),
			}),
		);

		await service.update(FEEDBACK_ID, { status: "reviewing" }, "admin_2");

		expect(repository.adminUpdate).toHaveBeenCalledWith(
			FEEDBACK_ID,
			{ status: "reviewing", resolvedAt: null },
			[
				{
					feedbackId: FEEDBACK_ID,
					kind: "status_changed",
					fromValue: "resolved",
					toValue: "reviewing",
					actorUserId: "admin_2",
				},
			],
		);
	});

	it("returns the current detail without writing when every supplied value is unchanged", async () => {
		const { repository, service } = setup();

		const result = await service.update(
			FEEDBACK_ID,
			{ status: "new", priority: "medium", adminNote: "" },
			"admin_1",
		);

		expect(repository.adminUpdate).not.toHaveBeenCalled();
		expect(repository.adminFindById).toHaveBeenCalledOnce();
		expect(repository.listActivity).toHaveBeenCalledOnce();
		expect(result.id).toBe(FEEDBACK_ID);
	});

	it("deletes feedback before its screenshot and returns the strict success shape", async () => {
		const screenshotUrl = `https://assets.example.com/feedback/${FEEDBACK_ID}/screenshot.png`;
		const { repository, service } = setup(feedbackRow({ screenshotUrl }));

		await expect(service.remove(FEEDBACK_ID, "admin_1")).resolves.toEqual({
			deleted: true,
		});

		expect(repository.adminFindById).toHaveBeenCalledWith(FEEDBACK_ID);
		expect(repository.delete).toHaveBeenCalledWith(FEEDBACK_ID);
		expect(publicAssetKeyFromUrl).toHaveBeenCalledWith(screenshotUrl);
		expect(isR2Configured).toHaveBeenCalledOnce();
		expect(deleteObject).toHaveBeenCalledWith(
			`feedback/${FEEDBACK_ID}/screenshot.png`,
		);
		const [databaseDeleteOrder] = repository.delete.mock.invocationCallOrder;
		const [screenshotDeleteOrder] =
			vi.mocked(deleteObject).mock.invocationCallOrder;

		if (
			databaseDeleteOrder === undefined ||
			screenshotDeleteOrder === undefined
		) {
			throw new Error("Expected both delete operations");
		}

		expect(databaseDeleteOrder).toBeLessThan(screenshotDeleteOrder);
	});

	it("returns 404 for missing detail, update, and delete targets", async () => {
		const { repository, service } = setup(null);

		await expect(service.get(FEEDBACK_ID)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await expect(
			service.update(FEEDBACK_ID, { status: "planned" }, "admin_1"),
		).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.remove(FEEDBACK_ID, "admin_1")).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(repository.delete).not.toHaveBeenCalled();
		expect(deleteObject).not.toHaveBeenCalled();
	});

	it("returns 404 without cleanup or an audit log when deletion loses a race", async () => {
		const { repository, service } = setup(
			feedbackRow({
				screenshotUrl: `https://assets.example.com/feedback/${FEEDBACK_ID}/screenshot.png`,
			}),
		);
		repository.delete.mockResolvedValueOnce(false);

		await expect(service.remove(FEEDBACK_ID, "admin_1")).rejects.toBeInstanceOf(
			NotFoundException,
		);

		expect(repository.delete).toHaveBeenCalledWith(FEEDBACK_ID);
		expect(publicAssetKeyFromUrl).not.toHaveBeenCalled();
		expect(isR2Configured).not.toHaveBeenCalled();
		expect(deleteObject).not.toHaveBeenCalled();
		expect(Logger.prototype.log).not.toHaveBeenCalled();
	});

	it("keeps deletion successful when screenshot cleanup fails", async () => {
		const { repository, service } = setup(
			feedbackRow({
				screenshotUrl: `https://assets.example.com/feedback/${FEEDBACK_ID}/screenshot.png`,
			}),
		);
		vi.mocked(deleteObject).mockRejectedValueOnce(new Error("R2 unavailable"));

		await expect(service.remove(FEEDBACK_ID, "admin_1")).resolves.toEqual({
			deleted: true,
		});
		expect(repository.row).toBeNull();
	});

	it("does not call R2 when feedback has no screenshot", async () => {
		const { repository, service } = setup();

		await expect(service.remove(FEEDBACK_ID, "admin_1")).resolves.toEqual({
			deleted: true,
		});

		expect(repository.delete).toHaveBeenCalledWith(FEEDBACK_ID);
		expect(publicAssetKeyFromUrl).not.toHaveBeenCalled();
		expect(isR2Configured).not.toHaveBeenCalled();
		expect(deleteObject).not.toHaveBeenCalled();
	});
});
