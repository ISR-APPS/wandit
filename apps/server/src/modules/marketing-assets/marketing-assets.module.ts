import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { MeteringModule } from "../metering/metering.module";
import { MarketingAssetsService } from "./application/services/marketing-assets.service";
import { MarketingAssetsRepository } from "./infrastructure/persistence/marketing-assets.repository";
import { MarketingAssetsController } from "./presentation/http/controllers/marketing-assets.controller";

@Module({
	controllers: [MarketingAssetsController],
	exports: [MarketingAssetsRepository, MarketingAssetsService],
	imports: [DatabaseModule, MeteringModule],
	providers: [MarketingAssetsRepository, MarketingAssetsService],
})
export class MarketingAssetsModule {}
