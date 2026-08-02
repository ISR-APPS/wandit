import { gateway } from "@ai-sdk/gateway";
import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { QueuesModule } from "../../infrastructure/queues/queues.module";
import { CreditsModule } from "../credits/credits.module";
import { MeteringService } from "./application/services/metering.service";
import { ModelPricingService } from "./application/services/model-pricing.service";
import {
	METERING_GATEWAY,
	METERING_RECONCILIATION_SCHEDULER,
} from "./domain/metering";
import { MeteringRepository } from "./infrastructure/persistence/metering.repository";
import { ModelPricesRepository } from "./infrastructure/persistence/model-prices.repository";
import { BullMqMeteringReconciliationScheduler } from "./infrastructure/queues/bullmq-metering-reconciliation.scheduler";

@Module({
	exports: [MeteringService, ModelPricingService],
	imports: [CreditsModule, DatabaseModule, QueuesModule],
	providers: [
		BullMqMeteringReconciliationScheduler,
		MeteringRepository,
		ModelPricesRepository,
		ModelPricingService,
		MeteringService,
		{ provide: METERING_GATEWAY, useValue: gateway },
		{
			provide: METERING_RECONCILIATION_SCHEDULER,
			useExisting: BullMqMeteringReconciliationScheduler,
		},
	],
})
export class MeteringModule {}
