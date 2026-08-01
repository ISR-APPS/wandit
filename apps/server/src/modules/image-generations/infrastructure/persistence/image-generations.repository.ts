/**
 * Persistence for durable standalone image-generation attempts.
 *
 * The chat tool creates a queued row before handing work to Trigger.dev. The
 * Trigger task advances that same row through generating -> succeeded/failed,
 * and the chat card + Assets tab read it through an ownership-checked
 * project join.
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
	ImageGenerationAspect,
	MediaGenerationStatus,
} from "@wandit/contracts";
import { and, desc, eq, isNull } from "@wandit/db";
import {
	type GeneratedImageRef,
	imageGenerationAttempts,
} from "@wandit/db/schema/image-generation-attempts";
import { projects } from "@wandit/db/schema/projects";
import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import { captureGenerationFailed } from "../../../../infrastructure/analytics/generation-events";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type ImageGenerationAttemptRow = {
	aspect: ImageGenerationAspect;
	completedAt: Date | null;
	count: number;
	createdAt: Date;
	error: string | null;
	id: string;
	images: GeneratedImageRef[] | null;
	projectId: string;
	prompt: string;
	sourceImageUrls: string[];
	status: MediaGenerationStatus;
	title: string;
};

const ATTEMPT_COLUMNS = {
	aspect: imageGenerationAttempts.aspect,
	completedAt: imageGenerationAttempts.completedAt,
	count: imageGenerationAttempts.count,
	createdAt: imageGenerationAttempts.createdAt,
	error: imageGenerationAttempts.error,
	id: imageGenerationAttempts.id,
	images: imageGenerationAttempts.images,
	projectId: imageGenerationAttempts.projectId,
	prompt: imageGenerationAttempts.prompt,
	sourceImageUrls: imageGenerationAttempts.sourceImageUrls,
	status: imageGenerationAttempts.status,
	title: imageGenerationAttempts.title,
} as const;

@Injectable()
export class ImageGenerationsRepository {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AnalyticsService)
		private readonly analyticsService: AnalyticsService,
	) {}

	async insertAttempt(input: {
		aspect: ImageGenerationAspect;
		chatId: string;
		count: number;
		projectId: string;
		prompt: string;
		requestKey: string;
		sourceImageUrls: string[];
		spec?: Record<string, unknown>;
		title: string;
	}): Promise<{
		created: boolean;
		id: string;
		status: ImageGenerationAttemptRow["status"];
	}> {
		const [row] = await this.db
			.insert(imageGenerationAttempts)
			.values(input)
			.onConflictDoNothing({
				target: [
					imageGenerationAttempts.chatId,
					imageGenerationAttempts.requestKey,
				],
			})
			.returning({
				id: imageGenerationAttempts.id,
				status: imageGenerationAttempts.status,
			});

		if (row) {
			return { ...row, created: true };
		}

		const [existing] = await this.db
			.select({
				id: imageGenerationAttempts.id,
				status: imageGenerationAttempts.status,
			})
			.from(imageGenerationAttempts)
			.where(
				and(
					eq(imageGenerationAttempts.chatId, input.chatId),
					eq(imageGenerationAttempts.requestKey, input.requestKey),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error(
				"Image generation idempotency conflict did not return an attempt",
			);
		}

		return { ...existing, created: false };
	}

	async markAttemptTriggered(
		attemptId: string,
		triggerRunId: string,
	): Promise<void> {
		await this.db
			.update(imageGenerationAttempts)
			.set({ triggerRunId })
			.where(eq(imageGenerationAttempts.id, attemptId));
	}

	async markAttemptFailed(
		attemptId: string,
		error: string,
		userId: string,
		reason: "stale_queued" | "trigger_rejected",
	): Promise<boolean> {
		const [row] = await this.db
			.update(imageGenerationAttempts)
			.set({
				completedAt: new Date(),
				error: error.slice(0, 2_000),
				status: "failed",
			})
			.where(
				and(
					eq(imageGenerationAttempts.id, attemptId),
					eq(imageGenerationAttempts.status, "queued"),
				),
			)
			.returning({ projectId: imageGenerationAttempts.projectId });

		if (!row) {
			return false;
		}

		captureGenerationFailed(
			this.analyticsService,
			userId,
			"image",
			row.projectId,
			attemptId,
			reason,
		);

		return true;
	}

	async findOwnedAttempt(
		userId: string,
		attemptId: string,
	): Promise<ImageGenerationAttemptRow | null> {
		const [row] = await this.db
			.select(ATTEMPT_COLUMNS)
			.from(imageGenerationAttempts)
			.innerJoin(projects, eq(projects.id, imageGenerationAttempts.projectId))
			.where(
				and(
					eq(imageGenerationAttempts.id, attemptId),
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async listOwnedByProject(
		userId: string,
		projectId: string,
	): Promise<ImageGenerationAttemptRow[]> {
		return this.db
			.select(ATTEMPT_COLUMNS)
			.from(imageGenerationAttempts)
			.innerJoin(projects, eq(projects.id, imageGenerationAttempts.projectId))
			.where(
				and(
					eq(imageGenerationAttempts.projectId, projectId),
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			)
			.orderBy(desc(imageGenerationAttempts.createdAt));
	}
}
