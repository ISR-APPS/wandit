// Sheet-sync endpoints for the Leads tab: GET answers "is Google connected /
// which sheet", POST performs the full-rewrite sync. Behind the global
// AuthGuard; ownership is proven in the repository join.
import {
	Controller,
	Get,
	HttpCode,
	Inject,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { type LeadSheetSyncState, uuidSchema } from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser, EarlyAccessGuard } from "../../../../auth";
import { LeadSheetSyncService } from "../../../application/services/lead-sheet-sync.service";

@Controller("v1")
export class LeadSheetSyncController {
	constructor(
		@Inject(LeadSheetSyncService)
		private readonly leadSheetSyncService: LeadSheetSyncService,
	) {}

	@Get("projects/:projectId/leads/sheet-sync")
	state(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
	): Promise<LeadSheetSyncState> {
		return this.leadSheetSyncService.getState(user.id, projectId);
	}

	// Sync is idempotent (full rewrite), so a repeat POST is safe — 200, not 201.
	@UseGuards(EarlyAccessGuard)
	@Post("projects/:projectId/leads/sheet-sync")
	@HttpCode(200)
	syncNow(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
	): Promise<LeadSheetSyncState> {
		return this.leadSheetSyncService.syncNow(user.id, projectId);
	}
}
