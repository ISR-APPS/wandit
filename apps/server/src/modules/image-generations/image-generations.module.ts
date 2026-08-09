import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { MeteringModule } from "../metering/metering.module";
import { PagesModule } from "../pages/pages.module";
import { ImageGenerationPlacementService } from "./application/services/image-generation-placement.service";
import { ImageGenerationsService } from "./application/services/image-generations.service";
import { ImageGenerationsRepository } from "./infrastructure/persistence/image-generations.repository";
import { ImageGenerationsController } from "./presentation/http/controllers/image-generations.controller";

@Module({
	controllers: [ImageGenerationsController],
	exports: [ImageGenerationsRepository],
	imports: [DatabaseModule, MeteringModule, PagesModule],
	providers: [
		ImageGenerationPlacementService,
		ImageGenerationsRepository,
		ImageGenerationsService,
	],
})
export class ImageGenerationsModule {}
