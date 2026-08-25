import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
	generateImagePlacementSchema,
	type ImageGenerationAttempt,
} from "@wandit/contracts";
import { and, eq, lt } from "@wandit/db";
import { imageGenerationAttempts } from "@wandit/db/schema/image-generation-attempts";
import { env } from "@wandit/env/server";
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
	getObjectBytes,
	publicAssetKeyFromUrl,
} from "../../../../infrastructure/storage/r2";
import { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import { MeteringService } from "../../../metering/application/services/metering.service";
import {
	meteringSubjectFrom,
	type ProjectScope,
} from "../../../projects/domain/project-scope";
import {
	type ImageGenerationAttemptRow,
	ImageGenerationsRepository,
} from "../../infrastructure/persistence/image-generations.repository";
import { createImageGenerationBilling } from "./image-generation-billing";
import { ImageGenerationPlacementService } from "./image-generation-placement.service";
import { createStoredImagesRecovery } from "./stored-images-recovery";

const GENERATION_STALE_AFTER_MS = 15 * 60 * 1_000;
const QUEUED_STALE_AFTER_MS = 30 * 60 * 1_000;
const STALE_GENERATION_ERROR =
	"The images did not finish. Please try generating them again.";
const STALE_QUEUED_ERROR =
	"The image request did not reach the background generator. Please try again.";
const recoverStoredImages = createStoredImagesRecovery();

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

@Injectable()
export class ImageGenerationsService {
	constructor(
		@Inject(ImageGenerationsRepository)
		private readonly imageGenerationsRepository: ImageGenerationsRepository,
		@Inject(ImageGenerationPlacementService)
		private readonly imageGenerationPlacementService: ImageGenerationPlacementService,
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
		// Direct database access ONLY for the stale-generating settlement below —
		// the repository stays the single reader/writer for everything else.
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AnalyticsService)
		private readonly analyticsService: AnalyticsService,
		@Inject(LifecycleEventsService)
		private readonly lifecycleEventsService: LifecycleEventsService,
	) {}

	async attempt(
		scope: ProjectScope,
		attemptId: string,
	): Promise<ImageGenerationAttempt> {
		let row = await this.imageGenerationsRepository.findAccessibleAttempt(
			scope,
			attemptId,
		);

		if (!row) {
			throw new NotFoundException();
		}

		const staleCutoff = new Date(Date.now() - GENERATION_STALE_AFTER_MS);
		const queuedStaleCutoff = new Date(Date.now() - QUEUED_STALE_AFTER_MS);

		if (row.status === "queued" && row.createdAt < queuedStaleCutoff) {
			await this.imageGenerationsRepository.markAttemptFailed(
				row.id,
				STALE_QUEUED_ERROR,
				scope.userId,
				"stale_queued",
			);
			row = await this.imageGenerationsRepository.findAccessibleAttempt(
				scope,
				attemptId,
			);

			if (!row) {
				throw new NotFoundException();
			}
		}

		if (
			row.status === "generating" &&
			row.completedAt === null &&
			(await this.settleStaleGenerating(row, staleCutoff, scope))
		) {
			row = await this.imageGenerationsRepository.findAccessibleAttempt(
				scope,
				attemptId,
			);

			if (!row) {
				throw new NotFoundException();
			}
		}

		if (
			row.status === "succeeded" &&
			(await this.imageGenerationPlacementService.settle(row, row.images ?? []))
		) {
			row = await this.imageGenerationsRepository.findAccessibleAttempt(
				scope,
				attemptId,
			);

			if (!row) {
				throw new NotFoundException();
			}
		}

		// All failure paths converge here; the refund is idempotent so a
		// transient failure is retried by the next poll without double-refunding.
		if (row.status === "failed") {
			await createImageGenerationBilling({
				isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
				meteringService: this.meteringService,
			}).refund(meteringSubjectFrom(scope), row.id);
		}

		return mapAttemptRow(row);
	}

	async download(
		scope: ProjectScope,
		attemptId: string,
		index: number,
	): Promise<{ bytes: Uint8Array; fileName: string; mediaType: string }> {
		const row = await this.imageGenerationsRepository.findAccessibleAttempt(
			scope,
			attemptId,
		);

		if (row?.status !== "succeeded" || !row.images) {
			throw new NotFoundException();
		}

		// Indexed rows use their stable generation slots strictly so a missing
		// slot cannot serve a different image. Only legacy unindexed rows use
		// their rendered array position.
		const hasIndexedImages = row.images.some(
			(candidate) => candidate.index !== undefined,
		);
		const image = hasIndexedImages
			? row.images.find((candidate) => candidate.index === index)
			: row.images[index - 1];

		if (!image) {
			throw new NotFoundException();
		}

		const key = publicAssetKeyFromUrl(image.url);

		if (!key) {
			throw new NotFoundException();
		}

		const bytes = await getObjectBytes(key);

		if (!bytes) {
			throw new NotFoundException();
		}

		const extension = EXTENSION_BY_MEDIA_TYPE[image.mediaType] ?? "png";

		return {
			bytes,
			fileName: `${sanitizeFileName(row.title)}-${index}.${extension}`,
			mediaType: image.mediaType,
		};
	}

	/**
	 * A generating row past the stale window either recovers from its
	 * deterministic R2 objects or fails (status-guarded, so a concurrent
	 * worker settlement always wins).
	 */
	private async settleStaleGenerating(
		row: ImageGenerationAttemptRow,
		staleCutoff: Date,
		scope: ProjectScope,
	): Promise<boolean> {
		const [stale] = await this.db
			.select({ startedAt: imageGenerationAttempts.startedAt })
			.from(imageGenerationAttempts)
			.where(
				and(
					eq(imageGenerationAttempts.id, row.id),
					eq(imageGenerationAttempts.status, "generating"),
					lt(imageGenerationAttempts.startedAt, staleCutoff),
				),
			)
			.limit(1);

		if (!stale) {
			return false;
		}

		const recovered = await recoverStoredImages(row);

		if (recovered) {
			const actorUserId = await this.recoveryActorUserId(row, scope);
			// The deterministic upload proves provider work completed. Repair the
			// existing hold before publishing success; lookup avoids inventing an
			// unknown parent relationship for legacy/billing-off rows.
			await createImageGenerationBilling({
				isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
				meteringService: this.meteringService,
			}).settleExisting(meteringSubjectFrom(scope), row.id, recovered.length);

			const completed = await this.db.transaction(async (tx) => {
				const [updated] = await tx
					.update(imageGenerationAttempts)
					.set({
						completedAt: new Date(),
						error: null,
						images: recovered,
						status: "succeeded",
					})
					.where(
						and(
							eq(imageGenerationAttempts.id, row.id),
							eq(imageGenerationAttempts.status, "generating"),
						),
					)
					.returning({ projectId: imageGenerationAttempts.projectId });

				if (!updated) {
					return null;
				}

				if (actorUserId) {
					await this.lifecycleEventsService.enqueue(
						{
							event: "image_generated",
							idempotencyKey: `image_generated:${actorUserId}`,
							userId: actorUserId,
						},
						tx,
					);
				}

				return updated;
			});

			if (completed && actorUserId) {
				captureGenerationCompleted(
					this.analyticsService,
					actorUserId,
					"image",
					completed.projectId,
					row.id,
				);
			}

			return true;
		}

		const [failed] = await this.db
			.update(imageGenerationAttempts)
			.set({
				completedAt: new Date(),
				error: STALE_GENERATION_ERROR,
				status: "failed",
			})
			.where(
				and(
					eq(imageGenerationAttempts.id, row.id),
					eq(imageGenerationAttempts.status, "generating"),
					lt(imageGenerationAttempts.startedAt, staleCutoff),
				),
			)
			.returning({ projectId: imageGenerationAttempts.projectId });

		if (failed) {
			captureGenerationFailed(
				this.analyticsService,
				scope.userId,
				"image",
				failed.projectId,
				row.id,
				"stale_generation",
			);
		}

		return true;
	}

	private async recoveryActorUserId(
		row: ImageGenerationAttemptRow,
		scope: ProjectScope,
	): Promise<string | null> {
		const snapshotActor = actorUserIdFromAttemptSpec(row.spec);

		if (snapshotActor) {
			return snapshotActor;
		}

		// Pre-snapshot metered attempts retain the original queue actor on their
		// attempt-keyed usage event. Org lookup is payer-scoped, so another member
		// may safely perform recovery without replacing that actor.
		const usageEvent = await this.meteringService.findByIdempotencyKey(
			`image:${row.id}`,
			meteringSubjectFrom(scope),
		);

		if (usageEvent) {
			return usageEvent.userId;
		}

		// Personal attempts have only one authorized actor, so the polling scope is
		// a safe legacy fallback. A pre-snapshot org attempt admitted with billing
		// off has no recoverable actor; settle it without emitting a false milestone.
		return scope.kind === "personal" ? scope.userId : null;
	}
}

function actorUserIdFromAttemptSpec(
	spec: Record<string, unknown> | null,
): string | null {
	const actorUserId = spec?.actorUserId;

	return typeof actorUserId === "string" && actorUserId.length > 0
		? actorUserId
		: null;
}

function sanitizeFileName(title: string): string {
	const slug = title
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();

	return slug.length > 0 ? slug.slice(0, 60) : "wandit-image";
}

function mapAttemptRow(row: ImageGenerationAttemptRow): ImageGenerationAttempt {
	return {
		aspect: row.aspect,
		completedAt: row.completedAt?.toISOString() ?? null,
		count: row.count,
		createdAt: row.createdAt.toISOString(),
		error: row.error,
		id: row.id,
		images: row.images,
		placement: mapPlacementStatus(row.spec, row.status),
		prompt: row.prompt,
		sourceImageUrls: row.sourceImageUrls,
		status: row.status,
		title: row.title,
	};
}

function mapPlacementStatus(
	spec: Record<string, unknown> | null,
	attemptStatus: ImageGenerationAttemptRow["status"],
): ImageGenerationAttempt["placement"] {
	if (!spec) {
		return undefined;
	}

	const placement = spec.placement;

	if (!generateImagePlacementSchema.safeParse(placement).success) {
		return undefined;
	}

	if (typeof placement !== "object" || placement === null) {
		return undefined;
	}

	if (attemptStatus === "failed") {
		return { status: "failed" };
	}

	const status = "status" in placement ? placement.status : undefined;

	return status === "pending" || status === "applied" || status === "failed"
		? { status }
		: undefined;
}
