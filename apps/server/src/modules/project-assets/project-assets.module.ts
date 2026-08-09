import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { ImageGenerationsModule } from "../image-generations/image-generations.module";
import { MediaGenerationsModule } from "../media-generations/media-generations.module";
import { ProjectAssetsService } from "./application/services/project-assets.service";
import { ProjectAssetsRepository } from "./infrastructure/persistence/project-assets.repository";
import { ProjectAssetsController } from "./presentation/http/controllers/project-assets.controller";

// Assets tab backend: one ownership-checked list of every media file the AI
// produced for a project (standalone images, animations, page-build assets)
// plus a forced-download route.
@Module({
	controllers: [ProjectAssetsController],
	exports: [ProjectAssetsService],
	imports: [DatabaseModule, ImageGenerationsModule, MediaGenerationsModule],
	providers: [ProjectAssetsRepository, ProjectAssetsService],
})
export class ProjectAssetsModule {}
