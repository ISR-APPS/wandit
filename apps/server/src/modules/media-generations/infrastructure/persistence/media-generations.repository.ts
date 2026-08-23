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
	VideoQuality,
	VideoVoiceover,
} from "@wandit/contracts";
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "@wandit/db";
import {
	aiUsageEvents,
	aiUsageGenerationRefs,
} from "@wandit/db/schema/credits";
import { mediaGenerationAttempts } from "@wandit/db/schema/media-generation-attempts";
import { mediaGenerationLegs } from "@wandit/db/schema/media-generation-legs";
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
	actualDurationMs: number | null;
	aspect: ImageToVideoAspect;
	chainDepth: number;
	completedAt: Date | null;
	createdAt: Date;
	durationSeconds: number;
	error: string | null;
	id: string;
	kind: MediaGenerationKind;
	model: string | null;
	motion: ImageToVideoMotion | null;
	projectId: string;
	prompt: string;
	quality: string | null;
	sourceAttemptId: string | null;
	sourceDurationMs: number | null;
	sourceImageUrl: string | null;
	sourceMediaType: ImageToVideoSourceMediaType | null;
	sourceVideoMediaType: string | null;
	sourceVideoUrl: string | null;
	startedAt: Date | null;
	status: "queued" | "generating" | "succeeded" | "failed";
	talking: boolean | null;
	title: string | null;
	videoMediaType: string | null;
	videoUrl: string | null;
	voiceover: VideoVoiceover | null;
};

export type MediaGenerationLegRow = {
	attemptId: string;
	completedAt: Date | null;
	createdAt: Date;
	durationSeconds: 5 | 10;
	error: string | null;
	id: string;
	model: string;
	segmentKey: string | null;
	seq: number;
	sourceFrameKey: string | null;
	startedAt: Date | null;
	status: "queued" | "generating" | "succeeded" | "failed";
};

type InsertMediaGenerationAttemptBase = {
	aspect: ImageToVideoAspect;
	chainDepth?: number;
	chatId: string;
	/** Defaults to 5 for legacy image-animation rows. */
	durationSeconds?: number;
	/** Required for image animation, null for non-image source workflows. */
	motion?: ImageToVideoMotion | null;
	projectId: string;
	prompt: string;
	requestKey: string;
	sourceAttemptId?: string | null;
	sourceImageUrl?: string | null;
	sourceMediaType?: ImageToVideoSourceMediaType | null;
	sourceVideoMediaType?: string | null;
	sourceVideoUrl?: string | null;
	title?: string | null;
	voiceover?: VideoVoiceover | null;
};

/** Per-kind durable plan snapshots; invalid model/tier/voice triples do not type. */
export type InsertMediaGenerationAttemptInput =
	InsertMediaGenerationAttemptBase &
		(
			| {
					kind?: "image-animation";
					model: string;
					quality: VideoQuality;
					talking: boolean;
			  }
			| {
					kind: "text-to-video";
					model: string;
					quality: VideoQuality;
					talking: boolean;
			  }
			| {
					kind: "video-edit";
					model: string;
					quality: null;
					talking: null;
			  }
			| {
					kind: "video-product";
					model: string;
					quality: null;
					talking: null;
			  }
			| {
					kind: "video-extension";
					model: string;
					quality: VideoQuality;
					talking: false;
			  }
		);

export type InsertMediaGenerationLegInput = {
	durationSeconds: 5 | 10;
	model: string;
	seq: number;
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

export type WorkspaceMediaGenerationRow = SucceededMediaGenerationRow & {
	projectId: string;
	projectName: string;
};

export type MediaGenerationAssetIdentity = {
	id: string;
	projectId: string;
	videoUrl: string | null;
};

const ATTEMPT_COLUMNS = {
	actualDurationMs: mediaGenerationAttempts.actualDurationMs,
	aspect: mediaGenerationAttempts.aspect,
	chainDepth: mediaGenerationAttempts.chainDepth,
	completedAt: mediaGenerationAttempts.completedAt,
	createdAt: mediaGenerationAttempts.createdAt,
	durationSeconds: mediaGenerationAttempts.durationSeconds,
	error: mediaGenerationAttempts.error,
	id: mediaGenerationAttempts.id,
	kind: mediaGenerationAttempts.kind,
	model: mediaGenerationAttempts.model,
	motion: mediaGenerationAttempts.motion,
	projectId: mediaGenerationAttempts.projectId,
	prompt: mediaGenerationAttempts.prompt,
	quality: mediaGenerationAttempts.quality,
	sourceAttemptId: mediaGenerationAttempts.sourceAttemptId,
	sourceDurationMs: mediaGenerationAttempts.sourceDurationMs,
	sourceImageUrl: mediaGenerationAttempts.sourceImageUrl,
	sourceMediaType: mediaGenerationAttempts.sourceMediaType,
	sourceVideoMediaType: mediaGenerationAttempts.sourceVideoMediaType,
	sourceVideoUrl: mediaGenerationAttempts.sourceVideoUrl,
	startedAt: mediaGenerationAttempts.startedAt,
	status: mediaGenerationAttempts.status,
	talking: mediaGenerationAttempts.talking,
	title: mediaGenerationAttempts.title,
	videoMediaType: mediaGenerationAttempts.videoMediaType,
	videoUrl: mediaGenerationAttempts.videoUrl,
	voiceover: mediaGenerationAttempts.voiceover,
} as const;

const LEG_COLUMNS = {
	attemptId: mediaGenerationLegs.attemptId,
	completedAt: mediaGenerationLegs.completedAt,
	createdAt: mediaGenerationLegs.createdAt,
	durationSeconds: mediaGenerationLegs.durationSeconds,
	error: mediaGenerationLegs.error,
	id: mediaGenerationLegs.id,
	model: mediaGenerationLegs.model,
	segmentKey: mediaGenerationLegs.segmentKey,
	seq: mediaGenerationLegs.seq,
	sourceFrameKey: mediaGenerationLegs.sourceFrameKey,
	startedAt: mediaGenerationLegs.startedAt,
	status: mediaGenerationLegs.status,
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

	/**
	 * Resolves a source only when it is a completed attempt in the requesting
	 * project. A public video URL is deliberately insufficient authorization.
	 */
	async findSucceededForProject(
		projectId: string,
		attemptId: string,
	): Promise<MediaGenerationAttemptRow | null> {
		const [row] = await this.db
			.select(ATTEMPT_COLUMNS)
			.from(mediaGenerationAttempts)
			.where(
				and(
					eq(mediaGenerationAttempts.id, attemptId),
					eq(mediaGenerationAttempts.projectId, projectId),
					eq(mediaGenerationAttempts.status, "succeeded"),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async insertAttempt(input: InsertMediaGenerationAttemptInput): Promise<{
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

	/**
	 * Creates the extension parent and its immutable leg plan atomically. An
	 * idempotency replay returns the existing parent without duplicating legs.
	 */
	async insertExtensionAttempt(
		input: Extract<
			InsertMediaGenerationAttemptInput,
			{ kind: "video-extension" }
		>,
		legs: readonly InsertMediaGenerationLegInput[],
	): Promise<{
		created: boolean;
		id: string;
		status: MediaGenerationAttemptRow["status"];
	}> {
		if (
			legs.length < 1 ||
			legs.length > 3 ||
			legs.some((leg, index) => leg.seq !== index + 1)
		) {
			throw new Error("Video extension legs must be consecutive from 1 to 3");
		}

		return this.db.transaction(async (tx) => {
			const [row] = await tx
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
				await tx.insert(mediaGenerationLegs).values(
					legs.map((leg) => ({
						attemptId: row.id,
						durationSeconds: leg.durationSeconds,
						model: leg.model,
						seq: leg.seq,
					})),
				);

				return { ...row, created: true };
			}

			const [existing] = await tx
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
		});
	}

	async listLegs(attemptId: string): Promise<MediaGenerationLegRow[]> {
		const rows = await this.db
			.select(LEG_COLUMNS)
			.from(mediaGenerationLegs)
			.where(eq(mediaGenerationLegs.attemptId, attemptId))
			.orderBy(asc(mediaGenerationLegs.seq));

		return rows.map(narrowLegDuration);
	}

	async latestLegActivityAt(attemptId: string): Promise<Date | null> {
		const [row] = await this.db
			.select({
				activityAt:
					sql<Date | null>`max(greatest(${mediaGenerationLegs.startedAt}, ${mediaGenerationLegs.completedAt}))`.mapWith(
						mediaGenerationLegs.startedAt,
					),
			})
			.from(mediaGenerationLegs)
			.where(eq(mediaGenerationLegs.attemptId, attemptId));

		return row?.activityAt ?? null;
	}

	/** Durable provider-completion units captured before any media upload. */
	async providerEvidenceUnits(attemptId: string): Promise<0 | 1 | 2 | 3> {
		const [row] = await this.db
			.select({
				units: sql<number>`coalesce(sum(
					case
						when jsonb_typeof(${aiUsageGenerationRefs.stepUsage} -> 'metering' -> 'fixedUnits') = 'number'
						then (${aiUsageGenerationRefs.stepUsage} -> 'metering' ->> 'fixedUnits')::integer
						else 0
					end
				), 0)::integer`,
			})
			.from(aiUsageGenerationRefs)
			.innerJoin(
				aiUsageEvents,
				eq(aiUsageEvents.id, aiUsageGenerationRefs.usageEventId),
			)
			.where(eq(aiUsageEvents.idempotencyKey, `video:${attemptId}`));

		return narrowDeliveredUnits(Number(row?.units ?? 0));
	}

	async claimQueuedLeg(
		attemptId: string,
		seq: number,
	): Promise<MediaGenerationLegRow | null> {
		const [row] = await this.db
			.update(mediaGenerationLegs)
			.set({ startedAt: new Date(), status: "generating" })
			.where(
				and(
					eq(mediaGenerationLegs.attemptId, attemptId),
					eq(mediaGenerationLegs.seq, seq),
					eq(mediaGenerationLegs.status, "queued"),
				),
			)
			.returning(LEG_COLUMNS);

		return row ? narrowLegDuration(row) : null;
	}

	async recordGeneratingLegSourceFrame(
		attemptId: string,
		seq: number,
		sourceFrameKey: string,
	): Promise<boolean> {
		const [row] = await this.db
			.update(mediaGenerationLegs)
			.set({ sourceFrameKey })
			.where(
				and(
					eq(mediaGenerationLegs.attemptId, attemptId),
					eq(mediaGenerationLegs.seq, seq),
					eq(mediaGenerationLegs.status, "generating"),
					isNull(mediaGenerationLegs.sourceFrameKey),
				),
			)
			.returning({ id: mediaGenerationLegs.id });

		return Boolean(row);
	}

	async markGeneratingLegSucceeded(
		attemptId: string,
		seq: number,
		segmentKey: string,
	): Promise<boolean> {
		const [row] = await this.db
			.update(mediaGenerationLegs)
			.set({
				completedAt: new Date(),
				error: null,
				segmentKey,
				status: "succeeded",
			})
			.where(
				and(
					eq(mediaGenerationLegs.attemptId, attemptId),
					eq(mediaGenerationLegs.seq, seq),
					eq(mediaGenerationLegs.status, "generating"),
				),
			)
			.returning({ id: mediaGenerationLegs.id });

		return Boolean(row);
	}

	async markGeneratingLegFailed(
		attemptId: string,
		seq: number,
		error: string,
	): Promise<boolean> {
		const [row] = await this.db
			.update(mediaGenerationLegs)
			.set({
				completedAt: new Date(),
				error: error.slice(0, 2_000),
				status: "failed",
			})
			.where(
				and(
					eq(mediaGenerationLegs.attemptId, attemptId),
					eq(mediaGenerationLegs.seq, seq),
					eq(mediaGenerationLegs.status, "generating"),
				),
			)
			.returning({ id: mediaGenerationLegs.id });

		return Boolean(row);
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
					noLegActivityAtOrAfter(startedBefore),
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

	// Assets-tab isolation: every media attempt owns its whole R2 directory,
	// including failed attempts whose raw provider output must never surface as
	// a page-build asset.
	async listAssetIdentitiesForProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<MediaGenerationAssetIdentity[]> {
		return this.db
			.select({
				id: mediaGenerationAttempts.id,
				projectId: mediaGenerationAttempts.projectId,
				videoUrl: mediaGenerationAttempts.videoUrl,
			})
			.from(mediaGenerationAttempts)
			.innerJoin(projects, eq(projects.id, mediaGenerationAttempts.projectId))
			.where(
				and(
					eq(mediaGenerationAttempts.projectId, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			);
	}

	// Dashboard counterpart: uncapped so attempts outside the display-row cap,
	// including failed attempts, still retain ownership of their R2 directory.
	async listAssetIdentitiesForScope(
		scope: ProjectScope,
	): Promise<MediaGenerationAssetIdentity[]> {
		return this.db
			.select({
				id: mediaGenerationAttempts.id,
				projectId: mediaGenerationAttempts.projectId,
				videoUrl: mediaGenerationAttempts.videoUrl,
			})
			.from(mediaGenerationAttempts)
			.innerJoin(projects, eq(projects.id, mediaGenerationAttempts.projectId))
			.where(and(projectScopePredicate(scope), isNull(projects.deletedAt)));
	}

	// Dashboard Assets page: newest finished videos across every project the
	// scope can see, with the project attached for tile labels and download
	// links. The limit bounds the aggregate payload.
	async listSucceededForScope(
		scope: ProjectScope,
		limit: number,
	): Promise<WorkspaceMediaGenerationRow[]> {
		return this.db
			.select({
				completedAt: mediaGenerationAttempts.completedAt,
				createdAt: mediaGenerationAttempts.createdAt,
				id: mediaGenerationAttempts.id,
				kind: mediaGenerationAttempts.kind,
				projectId: mediaGenerationAttempts.projectId,
				projectName: projects.name,
				prompt: mediaGenerationAttempts.prompt,
				title: mediaGenerationAttempts.title,
				videoMediaType: mediaGenerationAttempts.videoMediaType,
				videoUrl: mediaGenerationAttempts.videoUrl,
			})
			.from(mediaGenerationAttempts)
			.innerJoin(projects, eq(projects.id, mediaGenerationAttempts.projectId))
			.where(
				and(
					eq(mediaGenerationAttempts.status, "succeeded"),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.orderBy(desc(mediaGenerationAttempts.createdAt))
			.limit(limit);
	}
}

function analyticsKind(kind: MediaGenerationKind): "animation" | "video" {
	switch (kind) {
		case "image-animation":
			return "animation";
		case "text-to-video":
		case "video-edit":
		case "video-extension":
		case "video-product":
			return "video";
	}
}

function noLegActivityAtOrAfter(cutoff: Date) {
	return sql<boolean>`not exists (
		select 1
		from ${mediaGenerationLegs}
		where ${mediaGenerationLegs.attemptId} = ${mediaGenerationAttempts.id}
			and (
				${mediaGenerationLegs.startedAt} >= ${cutoff}
				or ${mediaGenerationLegs.completedAt} >= ${cutoff}
			)
	)`;
}

function narrowLegDuration<T extends { durationSeconds: number }>(
	row: T,
): T & { durationSeconds: 5 | 10 } {
	if (row.durationSeconds !== 5 && row.durationSeconds !== 10) {
		throw new Error(
			`Video extension leg has invalid duration ${row.durationSeconds}`,
		);
	}

	return { ...row, durationSeconds: row.durationSeconds };
}

function narrowDeliveredUnits(units: number): 0 | 1 | 2 | 3 {
	if (units === 0 || units === 1 || units === 2 || units === 3) {
		return units;
	}

	throw new Error(`Video attempt has invalid provider evidence units ${units}`);
}
