/**
 * Persistence for durable image-to-video attempts.
 *
 * The chat tool creates a queued row before handing work to Trigger.dev. The
 * Trigger task advances that same row through generating -> succeeded/failed,
 * and the result card reads it through an ownership-checked project join.
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
	ImageToVideoAspect,
	ImageToVideoMotion,
	ImageToVideoSourceMediaType,
} from "@wandit/contracts";
import { and, eq, isNull, lt } from "@wandit/db";
import { mediaGenerationAttempts } from "@wandit/db/schema/media-generation-attempts";
import { projects } from "@wandit/db/schema/projects";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type MediaGenerationAttemptRow = {
	aspect: ImageToVideoAspect;
	completedAt: Date | null;
	createdAt: Date;
	durationSeconds: number;
	error: string | null;
	id: string;
	motion: ImageToVideoMotion;
	projectId: string;
	prompt: string;
	sourceImageUrl: string;
	sourceMediaType: ImageToVideoSourceMediaType;
	startedAt: Date | null;
	status: "queued" | "generating" | "succeeded" | "failed";
	videoMediaType: string | null;
	videoUrl: string | null;
};

const ATTEMPT_COLUMNS = {
	aspect: mediaGenerationAttempts.aspect,
	completedAt: mediaGenerationAttempts.completedAt,
	createdAt: mediaGenerationAttempts.createdAt,
	durationSeconds: mediaGenerationAttempts.durationSeconds,
	error: mediaGenerationAttempts.error,
	id: mediaGenerationAttempts.id,
	motion: mediaGenerationAttempts.motion,
	projectId: mediaGenerationAttempts.projectId,
	prompt: mediaGenerationAttempts.prompt,
	sourceImageUrl: mediaGenerationAttempts.sourceImageUrl,
	sourceMediaType: mediaGenerationAttempts.sourceMediaType,
	startedAt: mediaGenerationAttempts.startedAt,
	status: mediaGenerationAttempts.status,
	videoMediaType: mediaGenerationAttempts.videoMediaType,
	videoUrl: mediaGenerationAttempts.videoUrl,
} as const;

@Injectable()
export class MediaGenerationsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insertAttempt(input: {
		aspect: ImageToVideoAspect;
		chatId: string;
		motion: ImageToVideoMotion;
		projectId: string;
		prompt: string;
		requestKey: string;
		sourceImageUrl: string;
		sourceMediaType: ImageToVideoSourceMediaType;
	}): Promise<{
		created: boolean;
		id: string;
		status: MediaGenerationAttemptRow["status"];
	}> {
		const [row] = await this.db
			.insert(mediaGenerationAttempts)
			.values(input)
			.onConflictDoNothing({
				target: [
					mediaGenerationAttempts.chatId,
					mediaGenerationAttempts.requestKey,
				],
			})
			.returning({
				id: mediaGenerationAttempts.id,
				status: mediaGenerationAttempts.status,
			});

		if (row) {
			return { ...row, created: true };
		}

		const [existing] = await this.db
			.select({
				id: mediaGenerationAttempts.id,
				status: mediaGenerationAttempts.status,
			})
			.from(mediaGenerationAttempts)
			.where(
				and(
					eq(mediaGenerationAttempts.chatId, input.chatId),
					eq(mediaGenerationAttempts.requestKey, input.requestKey),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error(
				"Media generation idempotency conflict did not return an attempt",
			);
		}

		return { ...existing, created: false };
	}

	async markAttemptTriggered(
		attemptId: string,
		triggerRunId: string,
	): Promise<void> {
		await this.db
			.update(mediaGenerationAttempts)
			.set({ triggerRunId })
			.where(eq(mediaGenerationAttempts.id, attemptId));
	}

	async markAttemptFailed(attemptId: string, error: string): Promise<boolean> {
		const [row] = await this.db
			.update(mediaGenerationAttempts)
			.set({
				completedAt: new Date(),
				error: error.slice(0, 2_000),
				status: "failed",
			})
			.where(
				and(
					eq(mediaGenerationAttempts.id, attemptId),
					eq(mediaGenerationAttempts.status, "queued"),
				),
			)
			.returning({ id: mediaGenerationAttempts.id });

		return Boolean(row);
	}

	async findOwnedAttempt(
		userId: string,
		attemptId: string,
	): Promise<MediaGenerationAttemptRow | null> {
		return this.selectOwnedAttempt(userId, attemptId);
	}

	async markStaleGeneratingAttemptFailed(
		attemptId: string,
		startedBefore: Date,
		error: string,
	): Promise<boolean> {
		const [row] = await this.db
			.update(mediaGenerationAttempts)
			.set({
				completedAt: new Date(),
				error: error.slice(0, 2_000),
				status: "failed",
			})
			.where(
				and(
					eq(mediaGenerationAttempts.id, attemptId),
					eq(mediaGenerationAttempts.status, "generating"),
					lt(mediaGenerationAttempts.startedAt, startedBefore),
				),
			)
			.returning({ id: mediaGenerationAttempts.id });

		return Boolean(row);
	}

	async markStaleQueuedAttemptFailed(
		attemptId: string,
		createdBefore: Date,
		error: string,
	): Promise<boolean> {
		const [row] = await this.db
			.update(mediaGenerationAttempts)
			.set({
				completedAt: new Date(),
				error: error.slice(0, 2_000),
				status: "failed",
			})
			.where(
				and(
					eq(mediaGenerationAttempts.id, attemptId),
					eq(mediaGenerationAttempts.status, "queued"),
					lt(mediaGenerationAttempts.createdAt, createdBefore),
				),
			)
			.returning({ id: mediaGenerationAttempts.id });

		return Boolean(row);
	}

	async markGeneratingAttemptSucceeded(
		attemptId: string,
		videoUrl: string,
		videoMediaType: string,
	): Promise<boolean> {
		const [row] = await this.db
			.update(mediaGenerationAttempts)
			.set({
				completedAt: new Date(),
				error: null,
				status: "succeeded",
				videoMediaType,
				videoUrl,
			})
			.where(
				and(
					eq(mediaGenerationAttempts.id, attemptId),
					eq(mediaGenerationAttempts.status, "generating"),
				),
			)
			.returning({ id: mediaGenerationAttempts.id });

		return Boolean(row);
	}

	private async selectOwnedAttempt(
		userId: string,
		attemptId: string,
	): Promise<MediaGenerationAttemptRow | null> {
		const [row] = await this.db
			.select(ATTEMPT_COLUMNS)
			.from(mediaGenerationAttempts)
			.innerJoin(projects, eq(projects.id, mediaGenerationAttempts.projectId))
			.where(
				and(
					eq(mediaGenerationAttempts.id, attemptId),
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}
}
