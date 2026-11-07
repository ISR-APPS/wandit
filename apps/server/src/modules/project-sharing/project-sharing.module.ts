/**
 * Project sharing of V2 app projects: the Share dialog routes, transfer, move, and the
 * invitee routes of project email invitations (workspaces-sharing.md 2.2 and 5).
 * AppModule loads it only with `V2_BUILDER_ENABLED`, next to AppBuilderModule.
 * WorkspacesModule (global) gives the links, grants, members, and the membership cleanup.
 */
import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AppBackendsRepository } from "../app-builder/infrastructure/persistence/app-backends.repository";
import { SubscriptionsRepository } from "../billing/infrastructure/persistence/subscriptions.repository";
import { EmailModule } from "../email/email.module";
import { ProjectsModule } from "../projects/projects.module";
import { ProjectInvitationsService } from "./application/services/project-invitations.service";
import { ProjectSharingService } from "./application/services/project-sharing.service";
import { ProjectInvitationsRepository } from "./infrastructure/persistence/project-invitations.repository";
import { ProjectSharingRepository } from "./infrastructure/persistence/project-sharing.repository";
import { ProjectInvitationsController } from "./presentation/http/controllers/project-invitations.controller";
import { ProjectSharingController } from "./presentation/http/controllers/project-sharing.controller";

/** Not global: nothing outside this module calls its services. */
@Module({
	controllers: [ProjectInvitationsController, ProjectSharingController],
	imports: [DatabaseModule, EmailModule, ProjectsModule],
	providers: [
		// The move counts the destination backends under the same lock as a backend insert.
		AppBackendsRepository,
		ProjectInvitationsRepository,
		ProjectInvitationsService,
		ProjectSharingRepository,
		ProjectSharingService,
		// The move reads the destination plan: it decides the backend slots.
		SubscriptionsRepository,
	],
})
export class ProjectSharingModule {}
