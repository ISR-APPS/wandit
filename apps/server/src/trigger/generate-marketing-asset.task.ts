// FIRST import on purpose: raises process-wide fetch idle timeouts before the
// AI/storage SDK can issue a long-running document-generation request.
import "./undici-timeouts";

import { logger, metadata, queue, schemaTask } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import {
	parseMarketingAssetPayload,
	runMarketingAssetGeneration,
} from "../modules/marketing-assets/application/services/marketing-asset-runner";
import { triggerAnalytics } from "./init";
import { createMarketingAssetRuntime } from "./marketing-asset.runtime";

const marketingAssetQueue = queue({
	concurrencyLimit: 2,
	name: "marketing-asset-generation",
});

/**
 * The only marketing-asset execution entrypoint.
 *
 * Trigger retries are intentionally generous, but the database claim remains
 * the model-call authority. Once a row is generating, retries only recover
 * its deterministic R2 document or settle/refund it.
 */
export const generateMarketingAssetTask = schemaTask({
	id: "generate-marketing-asset",
	maxDuration: 420,
	queue: marketingAssetQueue,
	retry: {
		factor: 2,
		maxAttempts: 12,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 5_000,
		randomize: true,
	},
	schema: parseMarketingAssetPayload,
	// The Trigger delivery expires before stale queued rows are closed by the
	// API's read-time guard, so an undeliverable run never zombie-executes.
	ttl: "25m",
	run: async (payload, { ctx, signal }) => {
		const db = createDb();

		try {
			metadata
				.set("assetId", payload.assetId)
				.set("projectId", payload.projectId)
				.set("stage", "settling");

			const runtime = createMarketingAssetRuntime(db, triggerAnalytics);
			const result = await runMarketingAssetGeneration(payload, {
				dependencies: runtime.runner,
				runId: ctx.run.id,
				signal,
			});

			metadata.set("stage", result.status);
			logger.info(`Marketing asset ${payload.assetId} ${result.status}`, {
				reason: result.status === "failed" ? result.reason : undefined,
				recovered: result.status === "succeeded" ? result.recovered : undefined,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
