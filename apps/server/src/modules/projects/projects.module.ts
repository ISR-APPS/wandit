// Feature module for project CRUD: list, get, create, update, soft-delete,
// and the project access gate of `:projectId` routes.
// App-builder code resolves the repository and the service through the
// exports below; the V2 cleanup starter is a factory so a V1 deploy never
// constructs it. WorkspacesModule registers the exported ProjectAccessGuard
// as a global guard.
import { Module } from "@nestjs/common";
import { env } from "@wandit/env/server";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { DELETE_APP_PROJECT_TASK_STARTER } from "../app-builder/domain/ports/delete-app-project-task-starter";
import { TriggerDeleteAppProjectTaskStarter } from "../app-builder/infrastructure/trigger/trigger-delete-app-project-task-starter";
import { MeteringModule } from "../metering/metering.module";
import { ProjectAccessService } from "./application/services/project-access.service";
import { ProjectTitleService } from "./application/services/project-title.service";
import { ProjectsService } from "./application/services/projects.service";
import { ProjectsRepository } from "./infrastructure/persistence/projects.repository";
import { ProjectsController } from "./presentation/http/controllers/projects.controller";
import { ProjectAccessGuard } from "./presentation/http/guards/project-access.guard";

@Module({
	controllers: [ProjectsController],
	imports: [DatabaseModule, MeteringModule],
	providers: [
		ProjectAccessGuard,
		ProjectAccessService,
		ProjectsRepository,
		ProjectTitleService,
		ProjectsService,
		{
			provide: DELETE_APP_PROJECT_TASK_STARTER,
			// V1 boots without the app-builder module; the factory keeps the V2
			// task out of a V1 deploy.
			useFactory: () =>
				env.V2_BUILDER_ENABLED
					? new TriggerDeleteAppProjectTaskStarter()
					: null,
		},
	],
	// The V2 turn API reads `findEngineByIdForScope` through the repository
	// export; WANDIT-175 takes ProjectsService for the title call.
	exports: [
		ProjectAccessGuard,
		ProjectAccessService,
		ProjectsRepository,
		ProjectsService,
	],
})
export class ProjectsModule {}
