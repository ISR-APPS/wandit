/**
 * Background page build — runs on Trigger.dev, NOT inside the Nest app.
 *
 * The whole job in one sentence: read the attempt row that the generate_page
 * tool queued, ask the designer model for a full HTML page, upload it to R2,
 * and flip the attempt to succeeded/failed so the web's polling sees it.
 *
 * No NestJS imports here on purpose: the Trigger CLI bundles this file on its
 * own, and workspace packages (@wandit/db, @wandit/env) bundle fine, but the
 * Nest DI container does not exist in this process. The .env is auto-loaded
 * by the dev CLI from apps/server/.
 */
import { task } from "@trigger.dev/sdk";
import { createDb, desc, eq } from "@wandit/db";
import { artifacts, versions } from "@wandit/db/schema/artifacts";
import { pageGenerationAttempts } from "@wandit/db/schema/page-attempts";
import { generateText } from "ai";
import { z } from "zod";

import { pageHtmlKey, putPageHtml } from "../infrastructure/storage/r2";

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
	maxDuration: 600,
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

				// Mark "generating" + pin the run id so the row links to the
				// Trigger dashboard even if the tool's own update lost a race.
				await db
					.update(pageGenerationAttempts)
					.set({ status: "generating", triggerRunId: ctx.run.id })
					.where(eq(pageGenerationAttempts.id, attempt.id));

				// generateText, NOT streamText: nothing consumes deltas here —
				// the user sees progress through the attempt status, not tokens.
				const result = await generateText({
					model: attempt.model,
					prompt: spec.brief,
					system: spec.designerSystemPrompt,
				});

				const html = extractHtml(result.text);
				const versionId = crypto.randomUUID();
				const key = pageHtmlKey(attempt.projectId, versionId);

				// Upload BEFORE the DB transaction: a version row must never
				// point at an object that does not exist.
				await putPageHtml(key, html);

				// One transaction: version number, immutable version row, active
				// pointer, and attempt completion move together or not at all.
				const number = await db.transaction(async (tx) => {
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
						meta: { title: spec.title },
						number: nextNumber,
						projectId: attempt.projectId,
						r2Key: key,
					});

					await tx
						.update(artifacts)
						.set({ activeVersionId: versionId })
						.where(eq(artifacts.id, attempt.artifactId));

					await tx
						.update(pageGenerationAttempts)
						.set({
							completedAt: new Date(),
							status: "succeeded",
							versionId,
						})
						.where(eq(pageGenerationAttempts.id, attempt.id));

					return nextNumber;
				});

				// Returned for Trigger dashboard visibility only.
				return { number, versionId };
			} catch (error) {
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

/**
 * Models sometimes wrap output in markdown fences despite instructions.
 * Unwrap, then sanity-check the result actually looks like a full page —
 * a truncated or chatty response must fail loudly, not ship to the user.
 */
function extractHtml(raw: string): string {
	const trimmed = raw.trim();
	const fenced = /^```(?:html)?\s*\n([\s\S]*?)\n```\s*$/.exec(trimmed);
	const html = (fenced?.[1] ?? trimmed).trim();
	const start = html.slice(0, 20).toLowerCase();

	if (!start.startsWith("<!doctype") && !start.startsWith("<html")) {
		throw new Error(
			"Designer output does not start with an HTML document (got: " +
				`${html.slice(0, 80)}…)`,
		);
	}

	if (html.length < 2000) {
		throw new Error(
			`Designer output is suspiciously short (${html.length} chars) — ` +
				"a real landing page never is; refusing to publish it",
		);
	}

	return html;
}
