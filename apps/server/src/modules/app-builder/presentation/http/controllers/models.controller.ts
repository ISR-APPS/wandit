/**
 * `GET /api/v2/models`: the models the builder dropdown offers, with their
 * prices. It sits behind the global AuthGuard only: an invited collaborator
 * without the V2 rollout flag needs it too (workspaces-sharing.md 3.3).
 * It reads `LLM_MODEL_PRICES` and `V2_DEFAULT_MODEL`; it calls no database.
 */
import { Controller, Get, Inject } from "@nestjs/common";
import type { BuilderModelsResponse } from "@wandit/contracts";

import { LLM_MODEL_PRICES } from "../../../domain/llm-model-prices";
import { V2_ENV, type V2EnvSource } from "../../../infrastructure/env/v2-env";

/** The model list of the builder dropdown. */
@Controller("v2/models")
export class ModelsController {
	constructor(
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
	) {}

	// Every priced model is pickable: `assertPickableModel` applies the same
	// rule when a turn or a project starts.
	@Get()
	list(): BuilderModelsResponse {
		return {
			defaultModel: this.v2Env.V2_DEFAULT_MODEL ?? null,
			models: [...LLM_MODEL_PRICES],
		};
	}
}
