/**
 * HTTP routes of the SlickPay checkout (Algerian CIB / Edahabia cards).
 * The web pricing pages, the plan picker, and the SlickPay return page call them.
 * Each route calls SlickpayPaymentsService.
 */
import {
	Body,
	Controller,
	Get,
	Header,
	HttpCode,
	Inject,
	Param,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type BillingLocalPricingResponse,
	type SlickpayPaymentView,
	type StartSlickpayCheckoutBody,
	type StartSlickpayCheckoutResponse,
	startSlickpayCheckoutBodySchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { readRequestCountryCode } from "../../../../../infrastructure/http/request-country-code";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser, Public } from "../../../../auth";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { SlickpayPaymentsService } from "../../../application/services/slickpay-payments.service";
import { WebOriginWriteGuard } from "../guards/web-origin-write.guard";

/** SlickPay routes under /api/v1/billing. The checkout and confirm routes accept only the web origin (CSRF). */
@Controller("v1/billing")
export class SlickpayBillingController {
	constructor(
		@Inject(SlickpayPaymentsService)
		private readonly slickpayPayments: SlickpayPaymentsService,
	) {}

	// The answer depends on the visitor IP country, so no browser or CDN may cache it.
	@Public()
	@Get("local-pricing")
	@Header("Cache-Control", "private, no-store")
	localPricing(
		@Req() request: FastifyRequest,
	): Promise<BillingLocalPricingResponse> {
		return this.slickpayPayments.localPricing(
			readRequestCountryCode(request.headers),
		);
	}

	@UseGuards(WebOriginWriteGuard)
	@RequireWorkspacePermission("billing", "manage")
	@Post("slickpay/checkout")
	startCheckout(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Body(new ZodValidationPipe(startSlickpayCheckoutBodySchema))
		body: StartSlickpayCheckoutBody,
	): Promise<StartSlickpayCheckoutResponse> {
		return this.slickpayPayments.startCheckout(user, body, workspace);
	}

	// No workspace permission: the service answers only the payments of the caller.
	@UseGuards(WebOriginWriteGuard)
	@Post("slickpay/payments/:id/confirm")
	@HttpCode(200)
	confirm(
		@CurrentUser() user: AuthUser,
		@Param("id", new ZodValidationPipe(uuidSchema)) id: string,
	): Promise<SlickpayPaymentView> {
		return this.slickpayPayments.confirm(user, id);
	}
}
