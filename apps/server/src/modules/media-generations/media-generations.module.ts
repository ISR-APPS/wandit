import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { MeteringModule } from "../metering/metering.module";
import { MediaGenerationsService } from "./application/services/media-generations.service";
import { VideoDirectorService } from "./application/services/video-director";
import { MediaGenerationsRepository } from "./infrastructure/persistence/media-generations.repository";
import { MediaGenerationsController } from "./presentation/http/controllers/media-generations.controller";

@Module({
	controllers: [MediaGenerationsController],
	exports: [MediaGenerationsRepository, VideoDirectorService],
	imports: [DatabaseModule, MeteringModule],
	providers: [
		MediaGenerationsRepository,
		MediaGenerationsService,
		VideoDirectorService,
	],
})
export class MediaGenerationsModule {}
