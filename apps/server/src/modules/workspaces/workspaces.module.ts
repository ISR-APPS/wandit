import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { MemberLimitsService } from "./application/services/member-limits.service";
import { WorkspacesService } from "./application/services/workspaces.service";
import { WorkspaceMembersRepository } from "./infrastructure/persistence/members.repository";
import { OrganizationLimitsRepository } from "./infrastructure/persistence/organization-limits.repository";
import { MemberLimitsController } from "./presentation/http/controllers/member-limits.controller";
import { WorkspacesController } from "./presentation/http/controllers/workspaces.controller";
import { WorkspaceContextGuard } from "./presentation/http/guards/workspace-context.guard";

// Global for the same reason as AuthModule/SettingsModule: workspace scope is
// resolved on every authenticated request, and controllers anywhere consume
// @CurrentWorkspace().
//
// ORDERING: the APP_GUARD below must run AFTER AuthGuard (it needs
// request.user). Nest runs global guards in module registration order, so
// WorkspacesModule must be imported after AuthModule in AppModule.
@Global()
@Module({
	controllers: [MemberLimitsController, WorkspacesController],
	exports: [
		OrganizationLimitsRepository,
		WorkspaceContextGuard,
		WorkspaceMembersRepository,
	],
	imports: [DatabaseModule],
	providers: [
		MemberLimitsService,
		OrganizationLimitsRepository,
		WorkspaceMembersRepository,
		WorkspacesService,
		WorkspaceContextGuard,
		{
			provide: APP_GUARD,
			useExisting: WorkspaceContextGuard,
		},
	],
})
export class WorkspacesModule {}
