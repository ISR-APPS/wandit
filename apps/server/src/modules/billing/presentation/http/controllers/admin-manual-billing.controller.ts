/**
 * Admin HTTP routes for offline (cash or transfer) billing.
 * Lists and updates offline requests. Records and reverses wallet top-ups, and lists receipts.
 * Old manual subscriptions stay readable as history. Called by the admin SPA.
 * Calls ManualSubscriptionsService and ProductSettingsService.
 */
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
	type AdminListManualRequestsQuery,
	type AdminListManualRequestsResponse,
	type AdminListManualSubscriptionsQuery,
	type AdminListManualSubscriptionsResponse,
	type AdminListTopupReceiptsQuery,
	type AdminListTopupReceiptsResponse,
	type AdminManualBillingReceiptConfig,
	type AdminManualBillingStats,
	type AdminManualRequest,
	type AdminManualSubscriptionDetail,
	type AdminRecordTopupInput,
	type AdminReverseTopupInput,
	type AdminTopupReceipt,
	type AdminUpdateManualRequestBody,
	adminListManualRequestsQuerySchema,
	adminListManualSubscriptionsQuerySchema,
	adminListTopupReceiptsQuerySchema,
	adminRecordTopupInputSchema,
	adminReverseTopupInputSchema,
	adminUpdateManualRequestBodySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminOnly } from "../../../../admin/presentation/http/decorators/admin-only.decorator";
import { AdminPermission } from "../../../../admin/presentation/http/decorators/admin-permission.decorator";
import { CurrentUser } from "../../../../auth";
import { ProductSettingsService } from "../../../../settings";
import { ManualSubscriptionsService } from "../../../application/services/manual-subscriptions.service";

@Controller("v1/admin")
@AdminOnly()
@AdminPermission({ billing: ["read"] })
export class AdminManualBillingController {
	constructor(
		@Inject(ManualSubscriptionsService)
		private readonly manualSubscriptionsService: ManualSubscriptionsService,
		@Inject(ProductSettingsService)
		private readonly productSettingsService: ProductSettingsService,
	) {}

	@Get("manual-billing/receipt-config")
	async receiptConfig(): Promise<AdminManualBillingReceiptConfig> {
		const settings = await this.productSettingsService.get();

		return { dzdPerUsdRate: settings.dzdPerUsdRate / 100 };
	}

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
	// Support records the call outcome here. Record and reverse top-up stay behind "manage".
	@AdminPermission({ billing: ["update-request"] })
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

	@Get("manual-subscriptions/:id")
	getSubscription(
		@Param("id", new ZodValidationPipe(uuidSchema)) id: string,
	): Promise<AdminManualSubscriptionDetail> {
		return this.manualSubscriptionsService.getSubscription(id);
	}

	@Get("topup-receipts")
	listTopupReceipts(
		@Query(new ZodValidationPipe(adminListTopupReceiptsQuerySchema))
		query: AdminListTopupReceiptsQuery,
	): Promise<AdminListTopupReceiptsResponse> {
		return this.manualSubscriptionsService.listTopupReceipts(query);
	}

	// Money becomes credits here, so only "manage" can record it.
	@Post("topup-receipts")
	@AdminPermission({ billing: ["manage"] })
	@HttpCode(200)
	recordTopup(
		@CurrentUser() admin: AuthUser,
		@Body(new ZodValidationPipe(adminRecordTopupInputSchema))
		body: AdminRecordTopupInput,
	): Promise<AdminTopupReceipt> {
		return this.manualSubscriptionsService.recordTopup(admin.id, body);
	}

	@Post("topup-receipts/reverse")
	@AdminPermission({ billing: ["manage"] })
	@HttpCode(200)
	reverseTopup(
		@CurrentUser() admin: AuthUser,
		@Body(new ZodValidationPipe(adminReverseTopupInputSchema))
		body: AdminReverseTopupInput,
	): Promise<AdminTopupReceipt> {
		return this.manualSubscriptionsService.reverseTopup(admin.id, body);
	}
}
