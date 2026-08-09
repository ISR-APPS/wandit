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
	type AttachExternalDomainBody,
	type AttachExternalDomainResponse,
	attachExternalDomainBodySchema,
	type DetachDomainResponse,
	type ListDomainsResponse,
	type SearchDomainsQuery,
	type SearchDomainsResponse,
	type SetPrimaryDomainResponse,
	searchDomainsQuerySchema,
	type TransferUnlockDomainResponse,
	type UpdateDomainAutoRenewBody,
	type UpdateDomainAutoRenewResponse,
	updateDomainAutoRenewBodySchema,
	uuidSchema,
	type VerifyDomainResponse,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser, EarlyAccessGuard } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { DomainsService } from "../../../application/services/domains.service";
import {
	DomainRateLimit,
	DomainRateLimitGuard,
} from "../guards/rate-limit.guard";

@Controller("v1")
export class DomainsController {
	constructor(
		@Inject(DomainsService)
		private readonly domainsService: DomainsService,
	) {}

	@UseGuards(DomainRateLimitGuard)
	@DomainRateLimit({ limit: 20, windowMs: 60_000 })
	@Get("domains/search")
	search(
		@Query(new ZodValidationPipe(searchDomainsQuerySchema))
		query: SearchDomainsQuery,
		@CurrentUser() user: AuthUser,
	): Promise<SearchDomainsResponse> {
		return this.domainsService.search(user.id, query.q);
	}

	@Get("projects/:projectId/domains")
	list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ListDomainsResponse> {
		return this.domainsService.list(
			projectId,
			projectScopeFrom(workspace, user.id),
		);
	}

	@UseGuards(EarlyAccessGuard, DomainRateLimitGuard)
	@DomainRateLimit({ limit: 5, windowMs: 60_000 })
	@RequireWorkspacePermission("domain", "manage")
	@Post("projects/:projectId/domains/external")
	attachExternal(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(attachExternalDomainBodySchema))
		body: AttachExternalDomainBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<AttachExternalDomainResponse> {
		return this.domainsService.attachExternal(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
		);
	}

	@UseGuards(EarlyAccessGuard, DomainRateLimitGuard)
	@DomainRateLimit({ limit: 10, windowMs: 60_000 })
	@RequireWorkspacePermission("domain", "manage")
	@Post("domains/:id/verify")
	verify(
		@Param("id", new ZodValidationPipe(uuidSchema))
		id: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<VerifyDomainResponse> {
		return this.domainsService.verify(id, projectScopeFrom(workspace, user.id));
	}

	@Post("domains/:id/auto-renew")
	setAutoRenew(
		@Param("id", new ZodValidationPipe(uuidSchema))
		id: string,
		@Body(new ZodValidationPipe(updateDomainAutoRenewBodySchema))
		body: UpdateDomainAutoRenewBody,
		@CurrentUser() user: AuthUser,
	): Promise<UpdateDomainAutoRenewResponse> {
		return this.domainsService.setAutoRenew(id, user.id, body);
	}

	@RequireWorkspacePermission("domain", "manage")
	@Post("domains/:id/primary")
	setPrimary(
		@Param("id", new ZodValidationPipe(uuidSchema))
		id: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<SetPrimaryDomainResponse> {
		return this.domainsService.setPrimary(
			id,
			projectScopeFrom(workspace, user.id),
		);
	}

	@UseGuards(DomainRateLimitGuard)
	@DomainRateLimit({ limit: 3, windowMs: 60 * 60_000 })
	@Post("domains/:id/transfer-unlock")
	transferUnlock(
		@Param("id", new ZodValidationPipe(uuidSchema))
		id: string,
		@CurrentUser() user: AuthUser,
	): Promise<TransferUnlockDomainResponse> {
		return this.domainsService.transferUnlock(id, user.id);
	}

	// Auto-renew and transfer-unlock above stay purchaser-only on purpose:
	// they touch the buyer's own money/asset, never the workspace's.
	@RequireWorkspacePermission("domain", "manage")
	@Delete("domains/:id")
	detach(
		@Param("id", new ZodValidationPipe(uuidSchema))
		id: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<DetachDomainResponse> {
		return this.domainsService.detach(
			id,
			projectScopeFrom(workspace, user.id),
		);
	}
}
