import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { GenerationModule } from "../generation/generation.module";
import { MarketingAssetsService } from "./application/services/marketing-assets.service";
import { MarketingAssetsRepository } from "./infrastructure/persistence/marketing-assets.repository";
import { MarketingAssetsController } from "./presentation/http/controllers/marketing-assets.controller";

// GenerationModule exports GenerationPolicyService (read-time refunds of
// failed generations).
@Module({
	controllers: [MarketingAssetsController],
	exports: [MarketingAssetsRepository],
	imports: [DatabaseModule, GenerationModule],
	providers: [MarketingAssetsRepository, MarketingAssetsService],
})
export class MarketingAssetsModule {}
