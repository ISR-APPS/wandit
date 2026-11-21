/**
 * `GET /api/v2/models`: the models the builder dropdown offers, with their
 * prices. It sits behind the global AuthGuard only: an invited collaborator
 * without the V2 rollout flag needs it too (workspaces-sharing.md 3.3).
 * It reads `LLM_MODEL_PRICES`, `V2_DEFAULT_MODEL`, and the
 * `product_settings.v2DisabledModels` list through ProductSettingsService (30 s cache).
 */
import { Controller, Get, Inject } from "@nestjs/common";
import type { BuilderModelsResponse, ProductSettings } from "@wandit/contracts";

import { ProductSettingsService } from "../../../../settings";
import { LLM_MODEL_PRICES } from "../../../domain/llm-model-prices";
import { V2_ENV, type V2EnvSource } from "../../../infrastructure/env/v2-env";

/** The model list of the builder dropdown. */
@Controller("v2/models")
export class ModelsController {
	constructor(
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
		@Inject(ProductSettingsService)
		private readonly settings: {
			get(): Promise<Pick<ProductSettings, "v2DisabledModels">>;
		},
	) {}

	// Every priced model that ops did not turn off is pickable:
	// `resolvePickableModel` applies the same rule when a turn or a project starts.
	@Get()
	async list(): Promise<BuilderModelsResponse> {
		const { v2DisabledModels } = await this.settings.get();
		return {
			defaultModel: this.v2Env.V2_DEFAULT_MODEL ?? null,
			models: LLM_MODEL_PRICES.filter(
				(row) => !v2DisabledModels.includes(row.modelId),
			),
		};
	}
}
