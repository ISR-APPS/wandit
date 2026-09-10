/**
 * Closes page-build usage after all provider references become durable.
 * The page-build task calls these helpers on each terminal path.
 * These helpers call the capture buffer and metering service without Nest.
 */
import type { GenerationCaptureBuffer } from "../modules/ai-chat/agent/site-builder/generation-capture-buffer";
import type { SiteBuildMeteringStep } from "../modules/ai-chat/agent/site-builder/site-builder-agent";
import { fromOpenRouterModelId } from "../modules/ai-provider/domain/llm-provider";
import type { MeteringService } from "../modules/metering/application/services/metering.service";
import type { AiUsageEvent } from "../modules/metering/domain/metering";

type BuilderMeteringService = Pick<MeteringService, "refund" | "settle">;
type BuilderMeteringLogger = Pick<Console, "info">;

/**
 * A terminal page-build path may settle only after every observed provider
 * generation has been persisted. Returning false deliberately leaves the
 * reservation open for the scheduled recovery task.
 */
export async function flushPageBuildGenerationsForSettlement(
	buffer: GenerationCaptureBuffer | null,
	onFailure: (error: unknown) => void,
): Promise<boolean> {
	try {
		await buffer?.flush();
		return true;
	} catch (error) {
		onFailure(error);
		return false;
	}
}

/** Settles one model, refunds unused work, and leaves mixed-model usage for reconciliation. */
export async function closeBuilderMetering(
	meteringService: BuilderMeteringService,
	event: Pick<AiUsageEvent, "id">,
	steps: readonly SiteBuildMeteringStep[],
	failedProviderGenerationObserved: boolean,
	logger: BuilderMeteringLogger,
): Promise<void> {
	if (steps.length === 0) {
		// Failed provider evidence needs reconciliation even when the SDK records no usage step.
		if (failedProviderGenerationObserved) {
			return;
		}

		await meteringService.refund(event.id, "page_build_no_provider_usage");
		return;
	}

	const modelIds = steps.map((step) =>
		fromOpenRouterModelId(step.model.modelId),
	);
	const models = new Set(modelIds);

	// One price cannot represent a fallback chain. Reconciliation prices each recorded generation.
	// LIMIT: a fallback build holds its credits until the stale-reservation sweep reconciles them. Upgrade: settle each model's steps with its own price.
	if (models.size > 1) {
		logger.info(
			`Builder metering spans multiple models (${[...models].join(", ")}); reconciliation will settle each captured generation`,
		);
		return;
	}

	const settlementModel = modelIds[0];
	if (!settlementModel) {
		throw new Error("Builder metering step has no model identifier");
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
		modelId: settlementModel,
		pricing: "token",
		provider: providers.size === 1 ? steps[0]?.model.provider : "multiple",
		rawUsage: { steps: steps.map((step) => step.usage) },
		usage,
	});
}
