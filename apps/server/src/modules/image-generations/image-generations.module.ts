import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { GenerationModule } from "../generation/generation.module";
import { PagesModule } from "../pages/pages.module";
import { ImageGenerationPlacementService } from "./application/services/image-generation-placement.service";
import { ImageGenerationsService } from "./application/services/image-generations.service";
import { ImageGenerationsRepository } from "./infrastructure/persistence/image-generations.repository";
import { ImageGenerationsController } from "./presentation/http/controllers/image-generations.controller";

// GenerationModule exports GenerationPolicyService (read-time refunds of
// failed generations).
@Module({
	controllers: [ImageGenerationsController],
	exports: [ImageGenerationsRepository],
	imports: [DatabaseModule, GenerationModule, PagesModule],
	providers: [
		ImageGenerationPlacementService,
		ImageGenerationsRepository,
		ImageGenerationsService,
	],
})
export class ImageGenerationsModule {}
