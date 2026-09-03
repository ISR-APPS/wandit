// Reconciliation lookup router. Each generation ref remembers which provider
// produced it (providerSource on ai_usage_generation_refs); this gateway
// sends Vercel refs to the @ai-sdk/gateway client and OpenRouter refs to the
// generation REST API. Lazy construction keeps Vercel-only deployments from
// ever needing an OpenRouter key.
import { gateway } from "@ai-sdk/gateway";
import { env } from "@wandit/env/server";

import type { MeteringGateway } from "../../metering/domain/metering";
import { createOpenRouterGenerationInfo } from "./openrouter-generation-info";

export function createProviderMeteringGateway(): MeteringGateway {
	let openrouter: MeteringGateway | null = null;

	return {
		async getGenerationInfo(params) {
			if (params.source !== "openrouter") {
				if (!env.AI_GATEWAY_API_KEY) {
					// Retryable, never terminal — same contract as the OpenRouter
					// branch below: a missing key is deployment drift, not proof the
					// generation is unbillable. The sweep backs off instead of
					// terminalizing the event or crashing the whole task.
					throw Object.assign(
						new Error(
							"AI_GATEWAY_API_KEY is required to reconcile Vercel gateway generations",
						),
						{ retryable: true },
					);
				}

				return gateway.getGenerationInfo({ id: params.id });
			}

			if (!openrouter) {
				const apiKey = env.OPENROUTER_API_KEY;

				if (!apiKey) {
					// Retryable, never terminal: a generation ref outlives the routing
					// config that produced it, so a reconciler running without the key
					// (env drift, a rolled-back override) must leave the event
					// selectable for a later sweep instead of writing it off.
					throw Object.assign(
						new Error(
							"OPENROUTER_API_KEY is required to reconcile OpenRouter generations",
						),
						{ retryable: true },
					);
				}

				openrouter = createOpenRouterGenerationInfo({ apiKey });
			}

			return openrouter.getGenerationInfo(params);
		},
	};
}
