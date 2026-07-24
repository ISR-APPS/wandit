// Raw order HTTP functions. ApiService removes the { data, meta } envelope and
// each result is validated against the shared contracts before reaching React.

import {
	createOrderResponseSchema,
	ordersRoutes,
	paymentOrderSchema,
} from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";
import type {
	CreateDomainOrderBody,
	CreateOrderResponse,
	PaymentOrder,
	ReconcileSessionBody,
} from "./orders.dto";

export async function createDomainOrder(
	body: CreateDomainOrderBody,
): Promise<CreateOrderResponse> {
	const payload = await ApiService.post<unknown, CreateDomainOrderBody>(
		ordersRoutes.createDomain,
		body,
	);

	return createOrderResponseSchema.parse(payload);
}

export async function getOrder(orderId: string): Promise<PaymentOrder> {
	const payload = await ApiService.get<unknown>(ordersRoutes.byId(orderId));

	return paymentOrderSchema.parse(payload);
}

export async function reconcileSession(
	body: ReconcileSessionBody,
): Promise<PaymentOrder> {
	const payload = await ApiService.post<unknown, ReconcileSessionBody>(
		ordersRoutes.reconcileSession,
		body,
	);

	return paymentOrderSchema.parse(payload);
}
