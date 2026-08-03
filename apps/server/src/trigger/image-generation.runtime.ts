import { and, type createDb, eq, sql } from "@wandit/db";
import { imageGenerationAttempts } from "@wandit/db/schema/image-generation-attempts";
import { projects } from "@wandit/db/schema/projects";
import { env } from "@wandit/env/server";

import {
	type AnalyticsCapture,
	captureGenerationCompleted,
	captureGenerationFailed,
} from "../infrastructure/analytics/generation-events";
import {
	getObjectContentType,
	imageGenerationKey,
	publicAssetUrl,
} from "../infrastructure/storage/r2";
import {
	createImageGenerationBilling,
	type ImageGenerationBilling,
} from "../modules/image-generations/application/services/image-generation-billing";
import { ImageGenerationPlacementService } from "../modules/image-generations/application/services/image-generation-placement.service";
import type {
	GeneratedImageResult,
	ImageGenerationAttemptState,
	ImageGenerationRunnerDependencies,
} from "../modules/image-generations/application/services/image-generation-runner";
import { generateStandaloneImage } from "../modules/image-generations/application/services/image-generator";
import { ImageGenerationsRepository } from "../modules/image-generations/infrastructure/persistence/image-generations.repository";
import { PageEditsService } from "../modules/pages/application/services/page-edits.service";
import { PagesRepository } from "../modules/pages/infrastructure/persistence/pages.repository";
import { createTriggerMetering } from "./metering.runtime";

type TriggerDatabase = ReturnType<typeof createDb>;

const ATTEMPT_COLUMNS = {
	aspect: imageGenerationAttempts.aspect,
	completedAt: imageGenerationAttempts.completedAt,
	count: imageGenerationAttempts.count,
	error: imageGenerationAttempts.error,
	id: imageGenerationAttempts.id,
	images: imageGenerationAttempts.images,
	organizationId: projects.organizationId,
	projectDeletedAt: projects.deletedAt,
	projectId: imageGenerationAttempts.projectId,
	prompt: imageGenerationAttempts.prompt,
	sourceImageUrls: imageGenerationAttempts.sourceImageUrls,
	spec: imageGenerationAttempts.spec,
	startedAt: imageGenerationAttempts.startedAt,
	status: imageGenerationAttempts.status,
	title: imageGenerationAttempts.title,
	triggerRunId: imageGenerationAttempts.triggerRunId,
	userId: projects.userId,
} as const;

export type ImageGenerationRuntime = {
	runner: ImageGenerationRunnerDependencies;
};

/**
 * Concrete Trigger runtime adapter — the only place that knows about
 * Drizzle, R2, the provider helper, metering, and placement services.
 * Orchestration itself stays in the pure runner.
 */
export function createImageGenerationRuntime(
	db: TriggerDatabase,
	analytics: AnalyticsCapture,
): ImageGenerationRuntime {
	const billing = createBilling(db);
	const persistence = createPersistence(db, analytics);
	const pagesRepository = new PagesRepository(db, analytics);
	const pageEditsService = new PageEditsService(pagesRepository);
	const imageGenerationsRepository = new ImageGenerationsRepository(
		db,
		analytics,
	);
	const placementService = new ImageGenerationPlacementService(
		imageGenerationsRepository,
		pageEditsService,
		pagesRepository,
	);

	return {
		runner: {
			capture: billing.capture,
			claimQueued: persistence.claimQueued,
			fail: persistence.failFromStatus,
			generateOne: (attempt, subject, index, signal, onProviderGeneration) =>
				generateStandaloneImage({
					...(signal ? { abortSignal: signal } : {}),
					aspect: attempt.aspect,
					attemptId: attempt.id,
					index,
					// Metering identity comes from the queue-time subject: the acting
					// member (not the project creator) with the paying entity.
					metering: {
						operation: "image",
						organizationId: subject.organizationId ?? null,
						userId: subject.actorUserId,
					},
					...(onProviderGeneration ? { onProviderGeneration } : {}),
					projectId: attempt.projectId,
					prompt: attempt.prompt,
					sourceImageUrls: attempt.sourceImageUrls,
				}),
			loadAttempt: persistence.loadAttempt,
			markSucceeded: persistence.markSucceeded,
			now: () => new Date(),
			recoverStoredImages: createStoredImagesRecovery(),
			refund: billing.refund,
			reserve: billing.reserve,
			settle: billing.settle,
			settleExisting: billing.settleExisting,
			settlePlacement: async (attempt, images) => {
				await placementService.settle(attempt, images);
			},
		},
	};
}

function createBilling(db: TriggerDatabase): ImageGenerationBilling {
	return createImageGenerationBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: createTriggerMetering(db),
	});
}

function createPersistence(db: TriggerDatabase, analytics: AnalyticsCapture) {
	const loadAttempt = async (
		attemptId: string,
	): Promise<ImageGenerationAttemptState | null> => {
		const [row] = await db
			.select(ATTEMPT_COLUMNS)
			.from(imageGenerationAttempts)
			.innerJoin(projects, eq(projects.id, imageGenerationAttempts.projectId))
			.where(eq(imageGenerationAttempts.id, attemptId))
			.limit(1);

		return row ?? null;
	};

	const claimQueued = async (
		attempt: ImageGenerationAttemptState,
		input: { runId: string; startedAt: Date },
	): Promise<ImageGenerationAttemptState | null> => {
		const [claimed] = await db
			.update(imageGenerationAttempts)
			.set({
				error: null,
				startedAt: input.startedAt,
				status: "generating",
				triggerRunId: input.runId,
			})
			.where(
				and(
					eq(imageGenerationAttempts.id, attempt.id),
					eq(imageGenerationAttempts.projectId, attempt.projectId),
					eq(imageGenerationAttempts.status, "queued"),
				),
			)
			.returning({ id: imageGenerationAttempts.id });

		return claimed ? loadAttempt(claimed.id) : null;
	};

	const markSucceeded = async (
		attempt: ImageGenerationAttemptState,
		images: GeneratedImageResult[],
		completedAt: Date,
	): Promise<boolean> => {
		const [updated] = await db
			.update(imageGenerationAttempts)
			.set({
				completedAt,
				error: null,
				images,
				status: "succeeded",
			})
			.where(
				and(
					eq(imageGenerationAttempts.id, attempt.id),
					eq(imageGenerationAttempts.projectId, attempt.projectId),
					eq(imageGenerationAttempts.status, "generating"),
					sql`exists (
						select 1
						from ${projects}
						where ${projects.id} = ${imageGenerationAttempts.projectId}
							and ${projects.userId} = ${attempt.userId}
							and ${projects.deletedAt} is null
					)`,
				),
			)
			.returning({ id: imageGenerationAttempts.id });

		if (updated) {
			captureGenerationCompleted(
				analytics,
				attempt.userId,
				"image",
				attempt.projectId,
				attempt.id,
			);
		}

		return Boolean(updated);
	};

	const failFromStatus = async (
		attempt: ImageGenerationAttemptState,
		input: {
			completedAt: Date;
			error: string;
			expectedStatus: "queued" | "generating";
			reason: string;
		},
	): Promise<boolean> => {
		const [updated] = await db
			.update(imageGenerationAttempts)
			.set({
				completedAt: input.completedAt,
				error: input.error.slice(0, 2_000),
				status: "failed",
			})
			.where(
				and(
					eq(imageGenerationAttempts.id, attempt.id),
					eq(imageGenerationAttempts.projectId, attempt.projectId),
					eq(imageGenerationAttempts.status, input.expectedStatus),
				),
			)
			.returning({ id: imageGenerationAttempts.id });

		if (updated) {
			captureGenerationFailed(
				analytics,
				attempt.userId,
				"image",
				attempt.projectId,
				attempt.id,
				input.reason,
			);
		}

		return Boolean(updated);
	};

	return {
		claimQueued,
		failFromStatus,
		loadAttempt,
		markSucceeded,
	};
}

function createStoredImagesRecovery() {
	return async (
		attempt: Pick<ImageGenerationAttemptState, "count" | "id" | "projectId">,
	): Promise<GeneratedImageResult[] | null> => {
		const images: GeneratedImageResult[] = [];

		for (let index = 1; index <= attempt.count; index += 1) {
			let found: GeneratedImageResult | null = null;

			for (const candidate of [
				{ extension: "png", mediaType: "image/png" },
				{ extension: "jpg", mediaType: "image/jpeg" },
				{ extension: "webp", mediaType: "image/webp" },
			] as const) {
				const key = imageGenerationKey(
					attempt.projectId,
					attempt.id,
					index,
					candidate.extension,
				);
				const storedMediaType = await getObjectContentType(key);

				if (!storedMediaType) {
					continue;
				}

				found = {
					mediaType: storedMediaType.startsWith("image/")
						? storedMediaType
						: candidate.mediaType,
					url: publicAssetUrl(key),
				};
				break;
			}

			// Provider calls are sequential, so the first gap ends the durable
			// prefix. Return that prefix instead of discarding billable/deliverable
			// images after a process crash between calls.
			if (!found) {
				break;
			}

			images.push(found);
		}

		return images.length > 0 ? images : null;
	};
}
