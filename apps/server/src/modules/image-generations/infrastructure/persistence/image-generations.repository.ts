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
	GenerateImagePlacement,
	ImageGenerationAspect,
	MediaGenerationStatus,
} from "@wandit/contracts";
import { and, desc, eq, inArray, isNull, sql } from "@wandit/db";
import { versions } from "@wandit/db/schema/artifacts";
import {
	type GeneratedImageRef,
	imageGenerationAttempts,
} from "@wandit/db/schema/image-generation-attempts";
import { projects } from "@wandit/db/schema/projects";
import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import {
	type AnalyticsCapture,
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
	spec: Record<string, unknown> | null;
	status: MediaGenerationStatus;
	title: string;
};

export type PersistedImagePlacement = GenerateImagePlacement & {
	reason?: string;
	status: "applied" | "failed" | "pending";
	versionNumber?: number;
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
	spec: imageGenerationAttempts.spec,
	status: imageGenerationAttempts.status,
	title: imageGenerationAttempts.title,
} as const;

@Injectable()
export class ImageGenerationsRepository {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AnalyticsService)
		private readonly analyticsService: AnalyticsCapture,
	) {}

	// Generated-asset markers for the model-bound transcript: settled
	// successes only, constrained to the chat's own project (the ids come
	// from the chat's own tool parts — the filter is defense in depth).
	async listSucceededByIdsForProject(
		projectId: string,
		attemptIds: readonly string[],
	): Promise<Array<Pick<ImageGenerationAttemptRow, "id" | "images">>> {
		if (attemptIds.length === 0) {
			return [];
		}

		return this.db
			.select({
				id: imageGenerationAttempts.id,
				images: imageGenerationAttempts.images,
			})
			.from(imageGenerationAttempts)
			.where(
				and(
					inArray(imageGenerationAttempts.id, [...attemptIds]),
					eq(imageGenerationAttempts.projectId, projectId),
					eq(imageGenerationAttempts.status, "succeeded"),
				),
			);
	}

	/**
	 * Resolve a generated-image URL only when the exact recorded asset belongs
	 * to a succeeded attempt in the requesting project. Public reachability is
	 * deliberately insufficient authorization; the project and URL predicates
	 * both execute in the database query.
	 */
	async findSucceededImageByUrlForProject(
		projectId: string,
		url: string,
	): Promise<GeneratedImageRef | null> {
		const [row] = await this.db
			.select({ images: imageGenerationAttempts.images })
			.from(imageGenerationAttempts)
			.where(
				and(
					eq(imageGenerationAttempts.projectId, projectId),
					eq(imageGenerationAttempts.status, "succeeded"),
					sql`exists (
						select 1
						from jsonb_array_elements(coalesce(${imageGenerationAttempts.images}, '[]'::jsonb)) as image_ref
						where image_ref->>'url' = ${url}
					)`,
				),
			)
			.limit(1);

		return row?.images?.find((image) => image.url === url) ?? null;
	}

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

	/**
	 * Publish a captured, durably uploaded subset without terminalizing the
	 * attempt. The runner serializes these snapshots, and this status guard keeps
	 * a late progress write from overwriting a terminal result.
	 */
	async persistProgress(
		attemptId: string,
		projectId: string,
		images: GeneratedImageRef[],
	): Promise<boolean> {
		const [updated] = await this.db
			.update(imageGenerationAttempts)
			.set({ images })
			.where(
				and(
					eq(imageGenerationAttempts.id, attemptId),
					eq(imageGenerationAttempts.projectId, projectId),
					eq(imageGenerationAttempts.status, "generating"),
				),
			)
			.returning({ id: imageGenerationAttempts.id });

		return Boolean(updated);
	}

	async updatePlacement(
		attemptId: string,
		projectId: string,
		placement: PersistedImagePlacement,
	): Promise<void> {
		const canSettle =
			placement.status === "applied"
				? sql`(
					${imageGenerationAttempts.spec}->'placement'->>'status' = 'pending'
					or exists (
						select 1
						from ${versions}
						where ${versions.projectId} = ${projectId}
							and ${versions.meta}->>'source' = 'ai-edit'
							and ${versions.meta}->'receipt'->>'kind' = 'image-generation-placement'
							and ${versions.meta}->'receipt'->>'attemptId' = ${attemptId}
					)
				)`
				: sql`${imageGenerationAttempts.spec}->'placement'->>'status' = 'pending'`;

		await this.db
			.update(imageGenerationAttempts)
			.set({
				spec: sql`jsonb_set(
					coalesce(${imageGenerationAttempts.spec}, '{}'::jsonb),
					'{placement}',
					${JSON.stringify(placement)}::jsonb,
					true
				)`,
			})
			.where(
				and(
					eq(imageGenerationAttempts.id, attemptId),
					eq(imageGenerationAttempts.projectId, projectId),
					eq(imageGenerationAttempts.status, "succeeded"),
					canSettle,
				),
			);
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

	async findAccessibleAttempt(
		scope: ProjectScope,
		attemptId: string,
	): Promise<ImageGenerationAttemptRow | null> {
		const [row] = await this.db
			.select(ATTEMPT_COLUMNS)
			.from(imageGenerationAttempts)
			.innerJoin(projects, eq(projects.id, imageGenerationAttempts.projectId))
			.where(
				and(
					eq(imageGenerationAttempts.id, attemptId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async listForProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<ImageGenerationAttemptRow[]> {
		return this.db
			.select(ATTEMPT_COLUMNS)
			.from(imageGenerationAttempts)
			.innerJoin(projects, eq(projects.id, imageGenerationAttempts.projectId))
			.where(
				and(
					eq(imageGenerationAttempts.projectId, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.orderBy(desc(imageGenerationAttempts.createdAt));
	}

	// Dashboard Assets page: newest finished image attempts across every
	// project the scope can see, with the project name for tile labels. The
	// limit bounds the aggregate payload — older files stay reachable from
	// each project's own Assets tab.
	async listSucceededForScope(
		scope: ProjectScope,
		limit: number,
	): Promise<Array<ImageGenerationAttemptRow & { projectName: string }>> {
		return this.db
			.select({ ...ATTEMPT_COLUMNS, projectName: projects.name })
			.from(imageGenerationAttempts)
			.innerJoin(projects, eq(projects.id, imageGenerationAttempts.projectId))
			.where(
				and(
					eq(imageGenerationAttempts.status, "succeeded"),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.orderBy(desc(imageGenerationAttempts.createdAt))
			.limit(limit);
	}
}
