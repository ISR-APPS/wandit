import {
	Body,
	Controller,
	Get,
	HttpCode,
	Inject,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AdminEndManualSubscriptionInput,
	type AdminGrantManualSubscriptionInput,
	type AdminListManualRequestsQuery,
	type AdminListManualRequestsResponse,
	type AdminListManualSubscriptionsQuery,
	type AdminListManualSubscriptionsResponse,
	type AdminManualBillingStats,
	type AdminManualRequest,
	type AdminManualSubscriptionDetail,
	type AdminRenewManualSubscriptionInput,
	type AdminUpdateManualRequestBody,
	adminEndManualSubscriptionInputSchema,
	adminGrantManualSubscriptionInputSchema,
	adminListManualRequestsQuerySchema,
	adminListManualSubscriptionsQuerySchema,
	adminRenewManualSubscriptionInputSchema,
	adminUpdateManualRequestBodySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminOnly } from "../../../../admin/presentation/http/decorators/admin-only.decorator";
import { CurrentUser } from "../../../../auth";
import { ManualSubscriptionsService } from "../../../application/services/manual-subscriptions.service";

@Controller("v1/admin")
@AdminOnly()
export class AdminManualBillingController {
	constructor(
		@Inject(ManualSubscriptionsService)
		private readonly manualSubscriptionsService: ManualSubscriptionsService,
	) {}

	@Get("manual-billing/stats")
	stats(): Promise<AdminManualBillingStats> {
		return this.manualSubscriptionsService.getStats();
	}

	@Get("manual-requests")
	listRequests(
		@Query(new ZodValidationPipe(adminListManualRequestsQuerySchema))
		query: AdminListManualRequestsQuery,
	): Promise<AdminListManualRequestsResponse> {
		return this.manualSubscriptionsService.listRequests(query);
	}

	@Get("manual-requests/:id")
	getRequest(
		@Param("id", new ZodValidationPipe(uuidSchema)) id: string,
	): Promise<AdminManualRequest> {
		return this.manualSubscriptionsService.getRequest(id);
	}

	@Patch("manual-requests/:id")
	updateRequest(
		@CurrentUser() admin: AuthUser,
		@Param("id", new ZodValidationPipe(uuidSchema)) id: string,
		@Body(new ZodValidationPipe(adminUpdateManualRequestBodySchema))
		body: AdminUpdateManualRequestBody,
	): Promise<AdminManualRequest> {
		return this.manualSubscriptionsService.updateRequest(admin.id, id, body);
	}

	@Get("manual-subscriptions")
	listSubscriptions(
		@Query(new ZodValidationPipe(adminListManualSubscriptionsQuerySchema))
		query: AdminListManualSubscriptionsQuery,
	): Promise<AdminListManualSubscriptionsResponse> {
		return this.manualSubscriptionsService.listSubscriptions(query);
	}

	@Post("manual-subscriptions")
	@HttpCode(200)
	grant(
		@CurrentUser() admin: AuthUser,
		@Body(new ZodValidationPipe(adminGrantManualSubscriptionInputSchema))
		body: AdminGrantManualSubscriptionInput,
	): Promise<AdminManualSubscriptionDetail> {
		return this.manualSubscriptionsService.grant(admin.id, body);
	}

	@Get("manual-subscriptions/:id")
	getSubscription(
		@Param("id", new ZodValidationPipe(uuidSchema)) id: string,
	): Promise<AdminManualSubscriptionDetail> {
		return this.manualSubscriptionsService.getSubscription(id);
	}

	@Post("manual-subscriptions/:id/renew")
	@HttpCode(200)
	renew(
		@CurrentUser() admin: AuthUser,
		@Param("id", new ZodValidationPipe(uuidSchema)) id: string,
		@Body(new ZodValidationPipe(adminRenewManualSubscriptionInputSchema))
		body: AdminRenewManualSubscriptionInput,
	): Promise<AdminManualSubscriptionDetail> {
		return this.manualSubscriptionsService.renew(admin.id, id, body);
	}

	@Post("manual-subscriptions/:id/end")
	@HttpCode(200)
	end(
		@CurrentUser() admin: AuthUser,
		@Param("id", new ZodValidationPipe(uuidSchema)) id: string,
		@Body(new ZodValidationPipe(adminEndManualSubscriptionInputSchema))
		body: AdminEndManualSubscriptionInput,
	): Promise<AdminManualSubscriptionDetail> {
		return this.manualSubscriptionsService.end(admin.id, id, body);
	}
}
