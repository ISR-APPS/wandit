// Workspace Leads tab endpoints. All behind the global AuthGuard; ownership
// is proven in repository joins.
import { Body, Controller, Get, Inject, Param, Patch } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type LeadResponse,
	type LeadStatusUpdateBody,
	type LeadsResponse,
	leadStatusUpdateBodySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { LeadsService } from "../../../application/services/leads.service";

@Controller("v1")
export class LeadsController {
	constructor(
		@Inject(LeadsService)
		private readonly leadsService: LeadsService,
	) {}

	// Full list, newest first — the tab filters/paginates client-side.
	@Get("projects/:projectId/leads")
	list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
	): Promise<LeadsResponse> {
		return this.leadsService.list(user.id, projectId);
	}

	@Patch("projects/:projectId/leads/:leadId/status")
	updateStatus(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("leadId", new ZodValidationPipe(uuidSchema))
		leadId: string,
		@Body(new ZodValidationPipe(leadStatusUpdateBodySchema))
		body: LeadStatusUpdateBody,
		@CurrentUser() user: AuthUser,
	): Promise<LeadResponse> {
		return this.leadsService.updateStatus(
			user.id,
			projectId,
			leadId,
			body.status,
		);
	}
}
