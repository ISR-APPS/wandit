import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateDomainOrderBody,
	type CreateOrderResponse,
	createDomainOrderBodySchema,
	type PaymentOrder,
	type ReconcileSessionBody,
	reconcileSessionBodySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import {
	DomainRateLimit,
	DomainRateLimitGuard,
} from "../../../../domains/presentation/http/guards/rate-limit.guard";
import { OrdersService } from "../../../application/services/orders.service";

@Controller("v1/orders")
export class OrdersController {
	constructor(
		@Inject(OrdersService)
		private readonly ordersService: OrdersService,
	) {}

	// Each call creates a Stripe customer + checkout session and a registrar
	// availability request, so it gets the same budget as domain purchase had.
	@UseGuards(DomainRateLimitGuard)
	@DomainRateLimit({ limit: 5, windowMs: 60_000 })
	@Post("domain")
	createDomain(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(createDomainOrderBodySchema))
		body: CreateDomainOrderBody,
	): Promise<CreateOrderResponse> {
		return this.ordersService.createDomainOrder(user, body);
	}

	@Post("reconcile-session")
	reconcileSession(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(reconcileSessionBodySchema))
		body: ReconcileSessionBody,
	): Promise<PaymentOrder> {
		return this.ordersService.reconcileSessionForUser(user.id, body.sessionId);
	}

	@Get(":orderId")
	getById(
		@CurrentUser() user: AuthUser,
		@Param("orderId", new ZodValidationPipe(uuidSchema))
		orderId: string,
	): Promise<PaymentOrder> {
		return this.ordersService.getOrderForUser(user.id, orderId);
	}
}
