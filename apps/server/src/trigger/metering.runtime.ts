import type { createDb } from "@wandit/db";
import type { AnalyticsService } from "../infrastructure/analytics/analytics.service";
import { createProviderMeteringGateway } from "../modules/ai-provider/infrastructure/metering-provider-gateway";
import { ConnectorGenerationRecoveryService } from "../modules/connector-generations/application/services/connector-generation-recovery.service";
import { ConnectorGenerationsRepository } from "../modules/connector-generations/infrastructure/persistence/connector-generations.repository";
import { CreditsService } from "../modules/credits/application/services/credits.service";
import { CreditsRepository } from "../modules/credits/infrastructure/persistence/credits.repository";
import { MeteringService } from "../modules/metering/application/services/metering.service";
import {
	type ModelPricingCache,
	ModelPricingService,
} from "../modules/metering/application/services/model-pricing.service";
import { MeteringRepository } from "../modules/metering/infrastructure/persistence/metering.repository";
import { ModelPricesRepository } from "../modules/metering/infrastructure/persistence/model-prices.repository";
import { OrganizationLimitsRepository } from "../modules/workspaces/infrastructure/persistence/organization-limits.repository";

type TriggerDatabase = ReturnType<typeof createDb>;
const triggerModelPricingCache: ModelPricingCache = new Map();

type TriggerAnalytics = Pick<AnalyticsService, "capture">;

/** Hand-wires the same metering graph for Trigger.dev's non-Nest runtime. */
export function createTriggerMetering(db: TriggerDatabase): MeteringService {
	const credits = new CreditsService(new CreditsRepository(db));
	const pricing = createTriggerModelPricing(db);

	return new MeteringService(
		new MeteringRepository(db),
		credits,
		pricing,
		createProviderMeteringGateway(),
		new OrganizationLimitsRepository(db),
	);
}

export function createTriggerModelPricing(
	db: TriggerDatabase,
): ModelPricingService {
	return new ModelPricingService(new ModelPricesRepository(db), {
		cache: triggerModelPricingCache,
	});
}

/** Hand-wires checkpoint repair ahead of generic stranded-hold recovery. */
export function createTriggerMeteringRecovery(
	db: TriggerDatabase,
	analytics: TriggerAnalytics,
) {
	const metering = createTriggerMetering(db);
	const connectorRepository = new ConnectorGenerationsRepository(
		db,
		analytics as AnalyticsService,
	);

	return {
		connectorRecovery: new ConnectorGenerationRecoveryService(
			connectorRepository,
			metering,
			analytics as AnalyticsService,
		),
		metering,
	};
}
