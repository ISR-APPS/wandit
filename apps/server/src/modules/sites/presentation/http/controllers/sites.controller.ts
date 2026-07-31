// Publishing endpoints, all behind the global AuthGuard; ownership is
// proven in the repository queries (missing and not-owned both 404).
import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type DeploymentCurrentResponse,
	type ListDeploymentsResponse,
	type PublishDeploymentBody,
	type PublishDeploymentResponse,
	publishDeploymentBodySchema,
	type RollbackDeploymentBody,
	rollbackDeploymentBodySchema,
	type SlugAvailabilityQuery,
	type SlugAvailabilityResponse,
	slugAvailabilityQuerySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser, EarlyAccessGuard } from "../../../../auth";
import { SitesService } from "../../../application/services/sites.service";

@Controller("v1")
export class SitesController {
	constructor(
		@Inject(SitesService)
		private readonly sitesService: SitesService,
	) {}

	// Polled by the web while a publish is in flight.
	@Get("projects/:projectId/deployments/current")
	current(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
	): Promise<DeploymentCurrentResponse> {
		return this.sitesService.current(user.id, projectId);
	}

	@Get("projects/:projectId/deployments/slug-availability")
	slugAvailability(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Query(new ZodValidationPipe(slugAvailabilityQuerySchema))
		query: SlugAvailabilityQuery,
		@CurrentUser() user: AuthUser,
	): Promise<SlugAvailabilityResponse> {
		return this.sitesService.slugAvailability(user.id, projectId, query.slug);
	}

	@Get("projects/:projectId/deployments")
	list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
	): Promise<ListDeploymentsResponse> {
		return this.sitesService.list(user.id, projectId);
	}

	@UseGuards(EarlyAccessGuard)
	@Post("projects/:projectId/deployments")
	publish(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(publishDeploymentBodySchema))
		body: PublishDeploymentBody,
		@CurrentUser() user: AuthUser,
	): Promise<PublishDeploymentResponse> {
		return this.sitesService.publish(user.id, projectId, body);
	}

	// A rollback is a normal publish of an older deployment's bytes.
	@UseGuards(EarlyAccessGuard)
	@Post("projects/:projectId/deployments/rollback")
	rollback(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(rollbackDeploymentBodySchema))
		body: RollbackDeploymentBody,
		@CurrentUser() user: AuthUser,
	): Promise<PublishDeploymentResponse> {
		return this.sitesService.rollback(user.id, projectId, body);
	}

	@Delete("projects/:projectId/deployments/active")
	unpublish(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
	): Promise<DeploymentCurrentResponse> {
		return this.sitesService.unpublish(user.id, projectId);
	}
}
