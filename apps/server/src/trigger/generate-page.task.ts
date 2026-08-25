/**
 * Background page build — runs on Trigger.dev, NOT inside the Nest app.
 *
 * The whole job in one sentence: read the attempt row that the generate_page
 * tool queued, run the site-builder agent (a tool loop that writes files
 * into a virtual FS), upload the resulting files to R2, and flip the attempt
 * to succeeded/failed so the web's polling sees it.
 *
 * No NestJS imports here on purpose: the Trigger CLI bundles this file on its
 * own, and workspace packages (@wandit/db, @wandit/env) bundle fine, but the
 * Nest DI container does not exist in this process. The .env is auto-loaded
 * by the dev CLI from apps/server/.
 */
// FIRST import on purpose: raises the process-wide fetch idle timeouts
// before any AI/storage SDK can issue a request.
import type { MeteringSubject } from "../modules/credits/domain/credit-owner";
import "./undici-timeouts";

import { logger, metadata, task } from "@trigger.dev/sdk";
import { productSkuSchema } from "@wandit/contracts";
import { and, createDb, desc, eq, gt, inArray } from "@wandit/db";
import { artifacts, versions } from "@wandit/db/schema/artifacts";
import { pageGenerationAttempts } from "@wandit/db/schema/page-attempts";
import { projects } from "@wandit/db/schema/projects";
import { env } from "@wandit/env/server";
import { z } from "zod";
import {
	captureGenerationCompleted,
	captureGenerationFailed,
	machineFailureReason,
} from "../infrastructure/analytics/generation-events";
import {
	contentTypeFor,
	pageHtmlKey,
	projectThumbnailKey,
	publicAssetUrl,
	putSiteFile,
	siteFileKey,
} from "../infrastructure/storage/r2";
import { createBuildProgressTracker } from "../modules/ai-chat/agent/site-builder/build-progress";
import {
	captureGatewayGenerationError,
	createGenerationCaptureBuffer,
	type GenerationCaptureBuffer,
} from "../modules/ai-chat/agent/site-builder/generation-capture-buffer";
import {
	runSiteBuild,
	type SiteBuildMeteringStep,
} from "../modules/ai-chat/agent/site-builder/site-builder-agent";
import { LifecycleEventsService } from "../modules/lifecycle-events/application/services/lifecycle-events.service";
import { LifecycleEventsRepository } from "../modules/lifecycle-events/infrastructure/persistence/lifecycle-events.repository";
import type { MeteringService } from "../modules/metering/application/services/metering.service";
import type { AiUsageEvent } from "../modules/metering/domain/metering";
import { OPERATION_REGISTRY } from "../modules/metering/domain/operation-registry";
import {
	classifyBuildFailure,
	TaggedBuildError,
} from "../modules/pages/domain/build-failure";
import { appendProjectBrandAsset } from "./generate-page-brand";
import { enqueuePageGenerationLifecycleEvent } from "./generate-page-lifecycle";
import { flushPageBuildGenerationsForSettlement } from "./generate-page-metering";
import { triggerAnalytics } from "./init";
import { createTriggerMetering } from "./metering.runtime";

// The queue tool snapshots exactly this shape. Non-strict on purpose: rows
// queued by the retired art-director pipeline carry extra fields (art prompts,
// creative spec) that parse() strips — their brief/prompt/title still build.
const attemptSpecSchema = z.object({
	brief: z.string().min(1),
	// Resolved COD build path, persisted so the queued snapshot round-trips.
	codMode: z.enum(["simple", "max"]).optional(),
	designerSystemPrompt: z.string().min(1),
	// Legacy rows already use "website"; older rows may omit the field.
	pageKind: z.enum(["cod", "website"]).optional(),
	productSku: productSkuSchema.optional(),
	title: z.string().min(1),
});

export const generatePageTask = task({
	id: "generate-page",
	// Chromium for the screenshot passes plus the builder's in-memory file
	// map do not fit the 0.5 GB small-1x default: real builds died mid-run
	// with TASK_PROCESS_OOM_KILLED. 2 GB / 1 vCPU holds both with headroom.
	machine: "medium-1x",
	// One Builder tool loop with two screenshot review passes; typically a
	// few minutes. The generous ceiling is a safety net, not an estimate.
	maxDuration: 1800,
	retry: { maxAttempts: 1 },
	run: async (
		payload: {
			/** Role snapshot at queue time: owner/admin bypass the default limit. */
			actorIsLimitExempt?: boolean;
			/** Acting member (org builds); absent = pre-teams payload. */
			actorUserId?: string;
			attemptId: string;
			parentEventId?: string;
		},
		{ ctx, signal },
	) => {
		// Fresh pool per run; ended in `finally` so the worker process can be
		// reused without leaking Postgres connections.
		const db = createDb();
		const lifecycleEvents = new LifecycleEventsService(
			new LifecycleEventsRepository(db),
		);

		try {
			const [loaded] = await db
				.select({
					attempt: pageGenerationAttempts,
					organizationId: projects.organizationId,
					userId: projects.userId,
				})
				.from(pageGenerationAttempts)
				.innerJoin(projects, eq(projects.id, pageGenerationAttempts.projectId))
				.where(eq(pageGenerationAttempts.id, payload.attemptId))
				.limit(1);

			if (!loaded) {
				throw new Error(`Attempt ${payload.attemptId} not found`);
			}

			// The PROJECT's owner entity pays for page builds. The recorded actor
			// is the queueing member when the payload carries one (org builds),
			// falling back to the project creator for pre-teams payloads.
			const { attempt, organizationId, userId } = loaded;
			const subject: MeteringSubject = {
				actorUserId: payload.actorUserId ?? userId,
				organizationId,
				...(payload.actorIsLimitExempt ? { actorIsLimitExempt: true } : {}),
			};

			if (attempt.status === "succeeded") {
				logger.info(
					`Attempt ${attempt.id} already succeeded; duplicate task run skipped`,
				);

				return {
					skipped: true,
					versionId: attempt.versionId,
				};
			}

			// Atomically claim queued work or an explicit retry of a failed
			// attempt. Concurrent duplicate task runs cannot both build or mark
			// each other failed.
			const [claim] = await db
				.update(pageGenerationAttempts)
				.set({
					completedAt: null,
					dismissedAt: null,
					error: null,
					failureCode: null,
					lastProgressPercent: null,
					startedAt: new Date(),
					status: "generating",
					triggerRunId: ctx.run.id,
					versionId: null,
				})
				.where(
					and(
						eq(pageGenerationAttempts.id, attempt.id),
						inArray(pageGenerationAttempts.status, ["queued", "failed"]),
					),
				)
				.returning({ id: pageGenerationAttempts.id });

			if (!claim) {
				throw new Error(
					`Attempt ${attempt.id} is already being generated by another run`,
				);
			}

			const meteringService =
				env.GENERATION_BILLING_MODE === "off"
					? null
					: createTriggerMetering(db);
			let usageEvent: AiUsageEvent | null = null;
			const meteredSteps: SiteBuildMeteringStep[] = [];
			let meteringClosed = false;
			let generationCaptureBuffer: GenerationCaptureBuffer | null = null;
			let failedProviderGenerationObserved = false;
			// Terminal snapshot for the chat card: the stopped/failed card shows
			// the percent the build died at, even after a page reload.
			let latestProgressPercent: number | null = null;

			try {
				if (meteringService) {
					usageEvent = await meteringService.reserve("page_build", subject, {
						attemptRef: attempt.id,
						credits: OPERATION_REGISTRY.page_build.reserveFloorCredits,
						idempotencyKey: `page-build:${attempt.id}:${ctx.run.id}`,
						model: attempt.model,
						parentEventId: payload.parentEventId,
					});
				}

				const spec = attemptSpecSchema.parse(attempt.spec);
				const [projectBrand] = await db
					.select({ logoUrl: projects.logoUrl })
					.from(projects)
					.where(eq(projects.id, attempt.projectId))
					.limit(1);
				const brief = appendProjectBrandAsset(
					spec.brief,
					projectBrand?.logoUrl ?? null,
				);

				logger.info(
					`🚀 Build starting — page "${spec.title}", attempt ${attempt.id}, ` +
						`Builder ${attempt.model}`,
				);

				logger.info(
					"🧠 The Builder is writing the page now — two screenshot " +
						"review passes when vision and Playwright are available",
				);

				// Every run gets a fresh asset namespace. A deliberate retry
				// can never overwrite images referenced by an older version.
				const assetNamespace = `${attempt.id}-${crypto.randomUUID()}`;

				// Live progress for the chat card: builder tool events fold into
				// one metadata object that Realtime pushes to the subscribed card.
				const progress = createBuildProgressTracker({
					attemptId: assetNamespace,
					projectId: attempt.projectId,
					publish: (snapshot) => {
						if (typeof snapshot.percent === "number") {
							latestProgressPercent = Math.round(snapshot.percent);
						}

						metadata.set("progress", snapshot);
					},
				});
				let heroShotBase64: string | null = null;
				const usageEventId = usageEvent?.id;
				generationCaptureBuffer =
					meteringService && usageEventId
						? createGenerationCaptureBuffer((capture) =>
								meteringService.captureGeneration(usageEventId, capture),
							)
						: null;
				const activeGenerationCaptureBuffer = generationCaptureBuffer;

				// The build brain: a tool-loop agent writing into a virtual FS.
				// It validates its own output (index.html present, complete,
				// non-trivial) and throws human-readable errors on failure.
				const build = await runSiteBuild({
					abortSignal: signal,
					attemptId: assetNamespace,
					brief,
					model: attempt.model,
					onEvent: (event) => {
						if (event.type === "screenshot-pass") {
							heroShotBase64 =
								event.shots.find((shot) => shot.viewport === "desktop")
									?.base64 ?? heroShotBase64;
						}
						progress.emit(event);
					},
					pageKind: spec.pageKind ?? "website",
					...(meteringService && usageEventId && activeGenerationCaptureBuffer
						? {
								meteringService,
								onGenerationError: async (error: unknown) => {
									failedProviderGenerationObserved =
										(await captureGatewayGenerationError(
											activeGenerationCaptureBuffer,
											error,
										)) || failedProviderGenerationObserved;
								},
								onStepEnd: async (step: SiteBuildMeteringStep) => {
									meteredSteps.push(step);
									await activeGenerationCaptureBuffer.capture({
										providerMetadata: step.providerMetadata,
										stepUsage: step.usage,
									});
								},
								usageEventId,
							}
						: {}),
					projectId: attempt.projectId,
					system: spec.designerSystemPrompt,
					title: spec.title,
					subject,
				});

				// AI SDK swallows onStepEnd errors. Flush every exact metadata/usage
				// pair that could not be confirmed in the callback before settlement
				// or any R2/version publication is allowed to begin.
				await generationCaptureBuffer?.flush();

				if (meteringService && usageEvent) {
					await closeBuilderMetering(
						meteringService,
						usageEvent,
						attempt.model,
						meteredSteps,
						failedProviderGenerationObserved,
					);
					meteringClosed = true;
				}

				// Terminal shot uploads may still be in flight — settle them so
				// the final metadata push (done + 100%) lands before completion.
				await progress.idle();
				metadata.set("usage", build.usage);

				signal.throwIfAborted();
				const versionId = crypto.randomUUID();
				const key = pageHtmlKey(attempt.projectId, versionId);

				// Upload BEFORE the DB transaction: a version row must never
				// point at an object that does not exist. index.html keeps the
				// canonical key the pages service reads; extra files (if any)
				// land beside it.
				try {
					for (const file of build.files) {
						signal.throwIfAborted();
						const fileKey =
							file.path === "index.html"
								? key
								: siteFileKey(attempt.projectId, versionId, file.path);

						await putSiteFile(fileKey, file.content, contentTypeFor(file.path));
						logger.info(`☁️ Uploaded ${file.path} to R2 → ${fileKey}`);
					}
				} catch (error) {
					// An abort mid-upload is a cancellation, not a storage fault.
					if (signal.aborted) {
						throw error;
					}

					throw new TaggedBuildError(
						"Uploading the finished page to storage failed",
						"storage_failure",
						error,
					);
				}

				let previewImageUrl: string | null = null;
				if (heroShotBase64 && env.R2_PUBLIC_BASE_URL) {
					try {
						const thumbnailKey = projectThumbnailKey(
							attempt.projectId,
							versionId,
						);
						await putSiteFile(
							thumbnailKey,
							Buffer.from(heroShotBase64, "base64"),
							"image/jpeg",
						);
						previewImageUrl = publicAssetUrl(thumbnailKey);
					} catch (error) {
						logger.warn(
							`Thumbnail upload failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				}

				// A cancellation during the final upload may leave an orphaned
				// object, but it must never publish or activate a cancelled page.
				signal.throwIfAborted();

				// One transaction: version number, immutable version row, active
				// pointer, and attempt completion move together or not at all.
				const { activated, number } = await db.transaction(async (tx) => {
					// Row lock on the artifact — the SAME lock the ops pipeline
					// takes (insertVersionAndActivate), so concurrent builds and
					// edit saves serialize here instead of colliding on the
					// unique (artifactId, number) index.
					const [artifact] = await tx
						.select({ id: artifacts.id })
						.from(artifacts)
						.where(eq(artifacts.id, attempt.artifactId))
						.limit(1)
						.for("update");

					if (!artifact) {
						throw new Error(`Artifact ${attempt.artifactId} not found`);
					}

					const [latest] = await tx
						.select({ number: versions.number })
						.from(versions)
						.where(eq(versions.artifactId, attempt.artifactId))
						.orderBy(desc(versions.number))
						.limit(1);
					const nextNumber = (latest?.number ?? 0) + 1;

					await tx.insert(versions).values({
						artifactId: attempt.artifactId,
						id: versionId,
						meta: {
							builderSummary: build.summary,
							builderSteps: build.steps,
							files: build.files.map((file) => file.path),
							generationModels: {
								builder: attempt.model,
							},
							// Contract §9: absent source means LEGACY builder rows.
							source: "builder",
							pageKind: spec.pageKind ?? "website",
							title: spec.title,
						},
						number: nextNumber,
						projectId: attempt.projectId,
						productSku: spec.productSku ?? null,
						r2Key: key,
					});

					// A build queued LATER that already finished owns the active
					// pointer — a stale run must not clobber it. Its version row
					// and attempt completion are still recorded for history.
					const [newerSucceeded] = await tx
						.select({ id: pageGenerationAttempts.id })
						.from(pageGenerationAttempts)
						.where(
							and(
								eq(pageGenerationAttempts.artifactId, attempt.artifactId),
								eq(pageGenerationAttempts.status, "succeeded"),
								gt(pageGenerationAttempts.createdAt, attempt.createdAt),
							),
						)
						.limit(1);

					if (!newerSucceeded) {
						await tx
							.update(artifacts)
							.set({ activeVersionId: versionId })
							.where(eq(artifacts.id, attempt.artifactId));

						if (previewImageUrl) {
							await tx
								.update(projects)
								.set({ previewImageUrl })
								.where(eq(projects.id, attempt.projectId));
						}
					}

					const [completed] = await tx
						.update(pageGenerationAttempts)
						.set({
							completedAt: new Date(),
							status: "succeeded",
							versionId,
						})
						.where(
							and(
								eq(pageGenerationAttempts.id, attempt.id),
								eq(pageGenerationAttempts.status, "generating"),
								eq(pageGenerationAttempts.triggerRunId, ctx.run.id),
							),
						)
						.returning({ id: pageGenerationAttempts.id });

					if (!completed) {
						throw new Error(
							`Attempt ${attempt.id} lost its completion state transition`,
						);
					}

					return { activated: !newerSucceeded, number: nextNumber };
				});

				await enqueuePageGenerationLifecycleEvent(
					lifecycleEvents,
					subject.actorUserId,
					spec.pageKind,
					logger,
				);

				captureGenerationCompleted(
					triggerAnalytics,
					subject.actorUserId,
					"page",
					attempt.projectId,
					attempt.id,
				);

				const completionMessage = activated
					? `🎉 Version ${number} is live — it should now appear in the ` +
						`Page tab (versionId ${versionId})`
					: `📦 Version ${number} recorded (versionId ${versionId}) — a ` +
						"newer build already finished, so the active pointer was " +
						"left on its version";
				logger.info(
					`${completionMessage} — usage: in=${build.usage.inputTokens} ` +
						`out=${build.usage.outputTokens} total=${build.usage.totalTokens} ` +
						`steps=${build.steps}`,
				);

				// Returned for Trigger dashboard visibility only.
				return {
					activated,
					files: build.files.map((file) => file.path),
					number,
					steps: build.steps,
					versionId,
				};
			} catch (error) {
				let terminalError = error;
				const generationsReadyForSettlement =
					await flushPageBuildGenerationsForSettlement(
						generationCaptureBuffer,
						(captureError) => {
							// A known provider call must never be refunded just because its
							// generation reference could not be persisted during this run. Keep
							// the original provider error and leave the hold for recovery.
							logger.error(
								`Gateway generation capture failed: ${captureError instanceof Error ? captureError.message : String(captureError)}`,
							);
						},
					);

				if (
					generationsReadyForSettlement &&
					meteringService &&
					usageEvent &&
					!meteringClosed
				) {
					try {
						await closeBuilderMetering(
							meteringService,
							usageEvent,
							attempt.model,
							meteredSteps,
							failedProviderGenerationObserved,
						);
						meteringClosed = true;
					} catch (meteringError) {
						terminalError = meteringError;
						logger.error(
							`Metering settlement failed: ${meteringError instanceof Error ? meteringError.message : String(meteringError)}`,
						);
					}
				}

				// A user Stop (or dashboard cancel) is a decision, not a failure:
				// record "canceled" with the frozen percent and skip the failure
				// analytics. The stop endpoint usually flips the row first — this
				// CAS is the belt-and-suspenders for cancels it did not initiate.
				if (signal.aborted) {
					logger.info(
						`⏹️ Build stopped by cancellation at ${latestProgressPercent ?? 0}%`,
					);

					await db
						.update(pageGenerationAttempts)
						.set({
							completedAt: new Date(),
							lastProgressPercent: latestProgressPercent,
							status: "canceled",
						})
						.where(
							and(
								eq(pageGenerationAttempts.id, attempt.id),
								eq(pageGenerationAttempts.status, "generating"),
								eq(pageGenerationAttempts.triggerRunId, ctx.run.id),
							),
						);

					throw terminalError;
				}

				const failureCode = classifyBuildFailure(terminalError);

				logger.error(
					`❌ Build failed (${failureCode}): ${terminalError instanceof Error ? terminalError.message : String(terminalError)}`,
				);

				// Record the failure for the Page tab, then rethrow so the run
				// also shows as failed in the Trigger dashboard.
				const [failed] = await db
					.update(pageGenerationAttempts)
					.set({
						completedAt: new Date(),
						error:
							terminalError instanceof Error
								? terminalError.message
								: String(terminalError),
						failureCode,
						lastProgressPercent: latestProgressPercent,
						status: "failed",
					})
					.where(
						and(
							eq(pageGenerationAttempts.id, attempt.id),
							eq(pageGenerationAttempts.status, "generating"),
							eq(pageGenerationAttempts.triggerRunId, ctx.run.id),
						),
					)
					.returning({ id: pageGenerationAttempts.id });

				if (failed) {
					captureGenerationFailed(
						triggerAnalytics,
						subject.actorUserId,
						"page",
						attempt.projectId,
						attempt.id,
						machineFailureReason(terminalError),
					);
				}

				throw terminalError;
			}
		} finally {
			await db.$client.end();
		}
	},
});

async function closeBuilderMetering(
	meteringService: MeteringService,
	event: AiUsageEvent,
	model: string,
	steps: readonly SiteBuildMeteringStep[],
	failedProviderGenerationObserved = false,
): Promise<void> {
	if (steps.length === 0) {
		// A failed Gateway call has real provider evidence but no AI SDK usage
		// step. Keep the reservation open so the reconciliation sweep can fetch
		// authoritative usage from the captured generation reference.
		if (failedProviderGenerationObserved) {
			return;
		}

		await meteringService.refund(event.id, "page_build_no_provider_usage");
		return;
	}

	const usage = steps.reduce(
		(total, step) => {
			const inputTokens = step.usage.inputTokens ?? 0;
			const cacheReadTokens = step.usage.inputTokenDetails.cacheReadTokens ?? 0;
			const cacheWriteTokens =
				step.usage.inputTokenDetails.cacheWriteTokens ?? 0;
			const noCacheTokens =
				step.usage.inputTokenDetails.noCacheTokens ??
				Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens);

			return {
				inputTokenDetails: {
					cacheReadTokens:
						total.inputTokenDetails.cacheReadTokens + cacheReadTokens,
					cacheWriteTokens:
						total.inputTokenDetails.cacheWriteTokens + cacheWriteTokens,
					noCacheTokens: total.inputTokenDetails.noCacheTokens + noCacheTokens,
				},
				inputTokens: total.inputTokens + inputTokens,
				outputTokens: total.outputTokens + (step.usage.outputTokens ?? 0),
			};
		},
		{
			inputTokenDetails: {
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				noCacheTokens: 0,
			},
			inputTokens: 0,
			outputTokens: 0,
		},
	);
	const providers = new Set(steps.map((step) => step.model.provider));

	await meteringService.settle(event.id, {
		modelId: model,
		pricing: "token",
		provider: providers.size === 1 ? steps[0]?.model.provider : "multiple",
		rawUsage: { steps: steps.map((step) => step.usage) },
		usage,
	});
}
