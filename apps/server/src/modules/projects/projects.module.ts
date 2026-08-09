import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { MeteringModule } from "../metering/metering.module";
import { ProjectTitleService } from "./application/services/project-title.service";
import { ProjectsService } from "./application/services/projects.service";
import { ProjectsRepository } from "./infrastructure/persistence/projects.repository";
import { ProjectsController } from "./presentation/http/controllers/projects.controller";

@Module({
	controllers: [ProjectsController],
	imports: [DatabaseModule, MeteringModule],
	providers: [ProjectsRepository, ProjectTitleService, ProjectsService],
})
export class ProjectsModule {}
