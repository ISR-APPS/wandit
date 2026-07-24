import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { GenerationModule } from "../generation/generation.module";
import { MediaGenerationsService } from "./application/services/media-generations.service";
import { MediaGenerationsRepository } from "./infrastructure/persistence/media-generations.repository";
import { MediaGenerationsController } from "./presentation/http/controllers/media-generations.controller";

@Module({
	controllers: [MediaGenerationsController],
	exports: [MediaGenerationsRepository],
	imports: [DatabaseModule, GenerationModule],
	providers: [MediaGenerationsRepository, MediaGenerationsService],
})
export class MediaGenerationsModule {}
