/**
 * Workspaces module: the workspace guard, the workspace list, member limits, personal workspaces,
 * invite links, collaborators, and the membership cleanup.
 * AppModule imports it after AuthModule. It is global, so every module can read workspace scope.
 * It also registers ProjectAccessGuard from ProjectsModule as the next global guard.
 */
import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { ProjectAccessGuard } from "../projects";
import { ProjectsModule } from "../projects/projects.module";
import { InviteLinksService } from "./application/services/invite-links.service";
import { MemberLimitsService } from "./application/services/member-limits.service";
import { MembershipCleanupService } from "./application/services/membership-cleanup.service";
import { WorkspacesService } from "./application/services/workspaces.service";
import { InviteLinksRepository } from "./infrastructure/persistence/invite-links.repository";
import { WorkspaceMembersRepository } from "./infrastructure/persistence/members.repository";
import { MembershipCleanupRepository } from "./infrastructure/persistence/membership-cleanup.repository";
import { OrganizationLimitsRepository } from "./infrastructure/persistence/organization-limits.repository";
import { ProjectGrantsRepository } from "./infrastructure/persistence/project-grants.repository";
import { InviteLinksController } from "./presentation/http/controllers/invite-links.controller";
import { MemberLimitsController } from "./presentation/http/controllers/member-limits.controller";
import { WorkspaceSharingController } from "./presentation/http/controllers/workspace-sharing.controller";
import { WorkspacesController } from "./presentation/http/controllers/workspaces.controller";
import { WorkspaceContextGuard } from "./presentation/http/guards/workspace-context.guard";

// Global for the same reason as AuthModule/SettingsModule: workspace scope is
// resolved on every authenticated request, and controllers anywhere consume
// @CurrentWorkspace().
//
// ORDERING: the APP_GUARDs below must run AFTER AuthGuard (they need
// request.user). Nest runs global guards in module registration order, so
// WorkspacesModule must be imported after AuthModule in AppModule. Within
// this module, the providers order puts ProjectAccessGuard after
// WorkspaceContextGuard (workspaces-sharing.md 3.3).
@Global()
@Module({
	controllers: [
		InviteLinksController,
		MemberLimitsController,
		WorkspaceSharingController,
		WorkspacesController,
	],
	exports: [
		// ProjectSharingModule writes project links with it.
		InviteLinksRepository,
		// The Better Auth hooks (AuthModule) and project sharing run the cleanup.
		MembershipCleanupService,
		OrganizationLimitsRepository,
		// Project invitation accept writes the grant with it.
		ProjectGrantsRepository,
		WorkspaceContextGuard,
		WorkspaceMembersRepository,
		// The signup hook in AuthModule creates the personal workspace with it.
		WorkspacesService,
	],
	imports: [DatabaseModule, ProjectsModule],
	providers: [
		InviteLinksRepository,
		InviteLinksService,
		MemberLimitsService,
		MembershipCleanupRepository,
		MembershipCleanupService,
		OrganizationLimitsRepository,
		ProjectGrantsRepository,
		WorkspaceMembersRepository,
		WorkspacesService,
		WorkspaceContextGuard,
		{
			provide: APP_GUARD,
			useExisting: WorkspaceContextGuard,
		},
		{
			provide: APP_GUARD,
			useExisting: ProjectAccessGuard,
		},
	],
})
export class WorkspacesModule {}
