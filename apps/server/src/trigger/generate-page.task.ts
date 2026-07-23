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
import { logger, task } from "@trigger.dev/sdk";
import { and, createDb, desc, eq, gt } from "@wandit/db";
import { artifacts, versions } from "@wandit/db/schema/artifacts";
import { pageGenerationAttempts } from "@wandit/db/schema/page-attempts";
import { z } from "zod";
import {
	contentTypeFor,
	pageHtmlKey,
	putSiteFile,
	siteFileKey,
} from "../infrastructure/storage/r2";
import { runSiteBuild } from "../modules/ai-chat/agent/site-builder/site-builder-agent";

// Shape of the jsonb `spec` column, snapshotted at queue time by the tool.
// Parsed defensively: a bad row should fail with a clear message, not deep
// inside a model call.
const attemptSpecSchema = z.object({
	brief: z.string(),
	designerSystemPrompt: z.string(),
	title: z.string(),
});

export const generatePageTask = task({
	id: "generate-page",
	// Single build pass; typically a few minutes. The generous ceiling is a
	// safety net (Kimi's always-on reasoning is slow-ish), not an estimate.
	maxDuration: 1800,
	retry: { maxAttempts: 1 },
	run: async (payload: { attemptId: string }, { ctx }) => {
		// Fresh pool per run; ended in `finally` so the worker process can be
		// reused without leaking Postgres connections.
		const db = createDb();

		try {
			const [attempt] = await db
				.select()
				.from(pageGenerationAttempts)
				.where(eq(pageGenerationAttempts.id, payload.attemptId))
				.limit(1);

			if (!attempt) {
				throw new Error(`Attempt ${payload.attemptId} not found`);
			}

			try {
				const spec = attemptSpecSchema.parse(attempt.spec);

				logger.info(
					`🚀 Build starting — page "${spec.title}", attempt ${attempt.id}, ` +
						`model ${attempt.model}`,
				);

				// Mark "generating" + pin the run id so the row links to the
				// Trigger dashboard even if the tool's own update lost a race.
				await db
					.update(pageGenerationAttempts)
					.set({ status: "generating", triggerRunId: ctx.run.id })
					.where(eq(pageGenerationAttempts.id, attempt.id));

				logger.info(
					"🧠 The builder agent is writing the page now — single build " +
						"pass; expect a few minutes of [site-builder] logs below",
				);

				// The build brain: a tool-loop agent writing into a virtual FS.
				// It validates its own output (index.html present, complete,
				// non-trivial) and throws human-readable errors on failure.
				const build = await runSiteBuild({
					attemptId: attempt.id,
					brief: spec.brief,
					model: attempt.model,
					projectId: attempt.projectId,
					system: spec.designerSystemPrompt,
					title: spec.title,
				});

				const versionId = crypto.randomUUID();
				const key = pageHtmlKey(attempt.projectId, versionId);

				// Upload BEFORE the DB transaction: a version row must never
				// point at an object that does not exist. index.html keeps the
				// canonical key the pages service reads; extra files (if any)
				// land beside it.
				for (const file of build.files) {
					const fileKey =
						file.path === "index.html"
							? key
							: siteFileKey(attempt.projectId, versionId, file.path);

					await putSiteFile(fileKey, file.content, contentTypeFor(file.path));
					logger.info(`☁️ Uploaded ${file.path} to R2 → ${fileKey}`);
				}

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
							// Contract §9: absent source means LEGACY builder rows.
							source: "builder",
							title: spec.title,
						},
						number: nextNumber,
						projectId: attempt.projectId,
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
					}

					await tx
						.update(pageGenerationAttempts)
						.set({
							completedAt: new Date(),
							status: "succeeded",
							versionId,
						})
						.where(eq(pageGenerationAttempts.id, attempt.id));

					return { activated: !newerSucceeded, number: nextNumber };
				});

				logger.info(
					activated
						? `🎉 Version ${number} is live — it should now appear in the ` +
								`Page tab (versionId ${versionId})`
						: `📦 Version ${number} recorded (versionId ${versionId}) — a ` +
								"newer build already finished, so the active pointer was " +
								"left on its version",
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
				logger.error(
					`❌ Build failed: ${error instanceof Error ? error.message : String(error)}`,
				);

				// Record the failure for the Page tab, then rethrow so the run
				// also shows as failed in the Trigger dashboard.
				await db
					.update(pageGenerationAttempts)
					.set({
						completedAt: new Date(),
						error: error instanceof Error ? error.message : String(error),
						status: "failed",
					})
					.where(eq(pageGenerationAttempts.id, attempt.id));

				throw error;
			}
		} finally {
			await db.$client.end();
		}
	},
});
