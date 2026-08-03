import { Controller, Get, Inject } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type { ListWorkspacesResponse } from "@wandit/contracts";

import { CurrentUser } from "../../../../auth/presentation/http/decorators/current-user.decorator";
import { WorkspacesService } from "../../../application/services/workspaces.service";

@Controller("v1/workspaces")
export class WorkspacesController {
	constructor(
		@Inject(WorkspacesService)
		private readonly workspacesService: WorkspacesService,
	) {}

	@Get()
	list(@CurrentUser() user: AuthUser): Promise<ListWorkspacesResponse> {
		return this.workspacesService.listForUser(user.id);
	}
}
