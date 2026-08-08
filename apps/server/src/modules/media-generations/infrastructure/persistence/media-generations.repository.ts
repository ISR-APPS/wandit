/**
 * Persistence for durable video generation attempts (image animation and
 * text-to-video, discriminated by `kind`).
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
	MediaGenerationKind,
	VideoDurationSeconds,
	VideoVoiceover,
} from "@wandit/contracts";
import { and, desc, eq, inArray, isNull, lt } from "@wandit/db";
import { mediaGenerationAttempts } from "@wandit/db/schema/media-generation-attempts";
import { projects } from "@wandit/db/schema/projects";
import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import {
	captureGenerationCompleted,
	captureGenerationFailed,
} from "../../../../infrastructure/analytics/generation-events";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";

export type MediaGenerationAttemptRow = {
	aspect: ImageToVideoAspect;
	completedAt: Date | null;
	createdAt: Date;
	durationSeconds: number;
	error: string | null;
	id: string;
	kind: MediaGenerationKind;
	motion: ImageToVideoMotion | null;
	projectId: string;
	prompt: string;
	sourceImageUrl: string | null;
	sourceMediaType: ImageToVideoSourceMediaType | null;
	startedAt: Date | null;
	status: "queued" | "generating" | "succeeded" | "failed";
	title: string | null;
	videoMediaType: string | null;
	videoUrl: string | null;
	voiceover: VideoVoiceover | null;
};

export type SucceededMediaGenerationRow = {
	completedAt: Date | null;
	createdAt: Date;
	id: string;
	kind: MediaGenerationKind;
	prompt: string;
	title: string | null;
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
	kind: mediaGenerationAttempts.kind,
	motion: mediaGenerationAttempts.motion,
	projectId: mediaGenerationAttempts.projectId,
	prompt: mediaGenerationAttempts.prompt,
	sourceImageUrl: mediaGenerationAttempts.sourceImageUrl,
	sourceMediaType: mediaGenerationAttempts.sourceMediaType,
	startedAt: mediaGenerationAttempts.startedAt,
	status: mediaGenerationAttempts.status,
	title: mediaGenerationAttempts.title,
	videoMediaType: mediaGenerationAttempts.videoMediaType,
	videoUrl: mediaGenerationAttempts.videoUrl,
	voiceover: mediaGenerationAttempts.voiceover,
} as const;

@Injectable()
export class MediaGenerationsRepository {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AnalyticsService)
		private readonly analyticsService: AnalyticsService,
	) {}

	// Generated-asset markers for the model-bound transcript: settled
	// successes only, constrained to the chat's own project (the ids come
	// from the chat's own tool parts — the filter is defense in depth).
	async listSucceededByIdsForProject(
		projectId: string,
		attemptIds: readonly string[],
	): Promise<
		Array<Pick<MediaGenerationAttemptRow, "id" | "videoMediaType" | "videoUrl">>
	> {
		if (attemptIds.length === 0) {
			return [];
		}

		return this.db
			.select({
				id: mediaGenerationAttempts.id,
				videoMediaType: mediaGenerationAttempts.videoMediaType,
				videoUrl: mediaGenerationAttempts.videoUrl,
			})
			.from(mediaGenerationAttempts)
			.where(
				and(
					inArray(mediaGenerationAttempts.id, [...attemptIds]),
					eq(mediaGenerationAttempts.projectId, projectId),
					eq(mediaGenerationAttempts.status, "succeeded"),
				),
			);
	}

	async insertAttempt(input: {
		aspect: ImageToVideoAspect;
		chatId: string;
		/** Defaults to 5; text-to-video may render 10. */
		durationSeconds?: VideoDurationSeconds;
		/** Defaults to "image-animation" (the original mode). */
		kind?: MediaGenerationKind;
		/** Required for image animation, null for text-to-video (DB CHECK). */
		motion?: ImageToVideoMotion | null;
		projectId: string;
		prompt: string;
		requestKey: string;
		sourceImageUrl?: string | null;
		sourceMediaType?: ImageToVideoSourceMediaType | null;
		title?: string | null;
		voiceover?: VideoVoiceover | null;
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

	async markAttemptFailed(
		attemptId: string,
		error: string,
		userId: string,
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
				),
			)
			.returning({
				kind: mediaGenerationAttempts.kind,
				projectId: mediaGenerationAttempts.projectId,
			});

		if (!row) {
			return false;
		}

		captureGenerationFailed(
			this.analyticsService,
			userId,
			analyticsKind(row.kind),
			row.projectId,
			attemptId,
			"trigger_rejected",
		);

		return true;
	}

	async findAccessibleAttempt(
		scope: ProjectScope,
		attemptId: string,
	): Promise<MediaGenerationAttemptRow | null> {
		const [row] = await this.db
			.select(ATTEMPT_COLUMNS)
			.from(mediaGenerationAttempts)
			.innerJoin(projects, eq(projects.id, mediaGenerationAttempts.projectId))
			.where(
				and(
					eq(mediaGenerationAttempts.id, attemptId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async markStaleGeneratingAttemptFailed(
		attemptId: string,
		startedBefore: Date,
		error: string,
		userId: string,
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
			.returning({
				kind: mediaGenerationAttempts.kind,
				projectId: mediaGenerationAttempts.projectId,
			});

		if (!row) {
			return false;
		}

		captureGenerationFailed(
			this.analyticsService,
			userId,
			analyticsKind(row.kind),
			row.projectId,
			attemptId,
			"stale_generation",
		);

		return true;
	}

	async markStaleQueuedAttemptFailed(
		attemptId: string,
		createdBefore: Date,
		error: string,
		userId: string,
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
			.returning({
				kind: mediaGenerationAttempts.kind,
				projectId: mediaGenerationAttempts.projectId,
			});

		if (!row) {
			return false;
		}

		captureGenerationFailed(
			this.analyticsService,
			userId,
			analyticsKind(row.kind),
			row.projectId,
			attemptId,
			"stale_queued",
		);

		return true;
	}

	async markGeneratingAttemptSucceeded(
		attemptId: string,
		videoUrl: string,
		videoMediaType: string,
		userId: string,
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
			.returning({
				kind: mediaGenerationAttempts.kind,
				projectId: mediaGenerationAttempts.projectId,
			});

		if (!row) {
			return false;
		}

		captureGenerationCompleted(
			this.analyticsService,
			userId,
			analyticsKind(row.kind),
			row.projectId,
			attemptId,
		);

		return true;
	}

	// Assets tab: every finished video of one owned project, newest first.
	async listSucceededForProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<SucceededMediaGenerationRow[]> {
		return this.db
			.select({
				completedAt: mediaGenerationAttempts.completedAt,
				createdAt: mediaGenerationAttempts.createdAt,
				id: mediaGenerationAttempts.id,
				kind: mediaGenerationAttempts.kind,
				prompt: mediaGenerationAttempts.prompt,
				title: mediaGenerationAttempts.title,
				videoMediaType: mediaGenerationAttempts.videoMediaType,
				videoUrl: mediaGenerationAttempts.videoUrl,
			})
			.from(mediaGenerationAttempts)
			.innerJoin(projects, eq(projects.id, mediaGenerationAttempts.projectId))
			.where(
				and(
					eq(mediaGenerationAttempts.projectId, projectId),
					eq(mediaGenerationAttempts.status, "succeeded"),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.orderBy(desc(mediaGenerationAttempts.createdAt));
	}
}

function analyticsKind(kind: MediaGenerationKind): "animation" | "video" {
	return kind === "text-to-video" ? "video" : "animation";
}
