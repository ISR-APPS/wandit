import { gateway } from "@ai-sdk/gateway";
import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CreditsModule } from "../credits/credits.module";
import { MeteringService } from "./application/services/metering.service";
import { ModelPricingService } from "./application/services/model-pricing.service";
import { METERING_GATEWAY } from "./domain/metering";
import { MeteringRepository } from "./infrastructure/persistence/metering.repository";
import { ModelPricesRepository } from "./infrastructure/persistence/model-prices.repository";

@Module({
	exports: [MeteringService, ModelPricingService],
	imports: [CreditsModule, DatabaseModule],
	providers: [
		MeteringRepository,
		ModelPricesRepository,
		ModelPricingService,
		MeteringService,
		{ provide: METERING_GATEWAY, useValue: gateway },
	],
})
export class MeteringModule {}
