import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type {
	AdminFeedbackDetail,
	AdminFeedbackStats,
	AdminListFeedbackQuery,
	AdminListFeedbackResponse,
	AdminUpdateFeedbackInput,
} from "@wandit/contracts";

import {
	mapAdminFeedbackDetail,
	mapAdminFeedbackSummary,
} from "../../infrastructure/mappers/admin-feedback.mapper";
import {
	type AdminFeedbackUpdatePatch,
	type FeedbackActivityInsert,
	FeedbackRepository,
} from "../../infrastructure/persistence/feedback.repository";

@Injectable()
export class FeedbackAdminService {
	private readonly logger = new Logger(FeedbackAdminService.name);

	constructor(
		@Inject(FeedbackRepository)
		private readonly repository: FeedbackRepository,
	) {}

	async list(
		query: AdminListFeedbackQuery,
	): Promise<AdminListFeedbackResponse> {
		const page = await this.repository.adminList(query);

		return {
			items: page.items.map(mapAdminFeedbackSummary),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async get(feedbackId: string): Promise<AdminFeedbackDetail> {
		const row = await this.repository.adminFindById(feedbackId);

		if (!row) {
			throw new NotFoundException("Feedback not found");
		}

		const activity = await this.repository.listActivity(feedbackId);

		return mapAdminFeedbackDetail(row, activity);
	}

	stats(): Promise<AdminFeedbackStats> {
		return this.repository.adminStats();
	}

	async update(
		feedbackId: string,
		input: AdminUpdateFeedbackInput,
		actorUserId: string,
	): Promise<AdminFeedbackDetail> {
		const current = await this.repository.adminFindById(feedbackId);

		if (!current) {
			throw new NotFoundException("Feedback not found");
		}

		const patch: AdminFeedbackUpdatePatch = {};
		const activities: FeedbackActivityInsert[] = [];

		if (input.status !== undefined && input.status !== current.status) {
			patch.status = input.status;
			activities.push({
				feedbackId,
				kind: "status_changed",
				fromValue: current.status,
				toValue: input.status,
				actorUserId,
			});

			if (input.status === "resolved") {
				patch.resolvedAt = new Date();
			} else if (current.status === "resolved") {
				patch.resolvedAt = null;
			}
		}

		if (input.priority !== undefined && input.priority !== current.priority) {
			patch.priority = input.priority;
			activities.push({
				feedbackId,
				kind: "priority_changed",
				fromValue: current.priority,
				toValue: input.priority,
				actorUserId,
			});
		}

		if (
			input.adminNote !== undefined &&
			input.adminNote !== current.adminNote
		) {
			patch.adminNote = input.adminNote;
			activities.push({
				feedbackId,
				kind: "note_updated",
				fromValue: null,
				toValue: null,
				actorUserId,
			});
		}

		if (activities.length === 0) {
			const activity = await this.repository.listActivity(feedbackId);

			return mapAdminFeedbackDetail(current, activity);
		}

		await this.repository.adminUpdate(feedbackId, patch, activities);

		this.logger.log(
			`admin_feedback_update admin=${actorUserId} feedback=${feedbackId} changes=${activities
				.map((activity) => activity.kind)
				.join(",")}`,
		);

		return this.get(feedbackId);
	}
}
