import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
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
import { OrdersService } from "../../../application/services/orders.service";

@Controller("v1/orders")
export class OrdersController {
	constructor(
		@Inject(OrdersService)
		private readonly ordersService: OrdersService,
	) {}

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
