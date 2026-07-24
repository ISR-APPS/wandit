import { z } from "zod";
import { domainNameSchema, registrantSchema } from "./domains";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

export const paymentOrderKinds = ["domain_registration"] as const;

export const paymentOrderKindSchema = z.enum(paymentOrderKinds);

export type PaymentOrderKind = z.infer<typeof paymentOrderKindSchema>;

export const paymentOrderStatuses = [
	"pending",
	"paid",
	"fulfilling",
	"fulfilled",
	"failed",
	"canceled",
	"refunded",
] as const;

export const paymentOrderStatusSchema = z.enum(paymentOrderStatuses);

export type PaymentOrderStatus = z.infer<typeof paymentOrderStatusSchema>;

export const createDomainOrderBodySchema = z.object({
	domain: domainNameSchema,
	registrant: registrantSchema,
	projectId: uuidSchema.optional(),
	whoisPrivacy: z.boolean().optional(),
});

export type CreateDomainOrderBody = z.infer<typeof createDomainOrderBodySchema>;

export const paymentOrderSchema = z.object({
	id: uuidSchema,
	kind: paymentOrderKindSchema,
	status: paymentOrderStatusSchema,
	amountCents: z.int().positive(),
	currency: z
		.string()
		.length(3)
		.regex(/^[a-z]{3}$/),
	checkoutUrl: z.url().optional(),
	domainId: uuidSchema.optional(),
	createdAt: isoDateTimeSchema,
	paidAt: isoDateTimeSchema.nullable(),
	fulfilledAt: isoDateTimeSchema.nullable(),
	error: z.string().nullable(),
	refundStatus: z.string().nullable(),
});

export type PaymentOrder = z.infer<typeof paymentOrderSchema>;

export const createOrderResponseSchema = z.object({
	order: paymentOrderSchema,
	checkoutUrl: z.url(),
});

export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;

export const reconcileSessionBodySchema = z.object({
	sessionId: z.string().min(1),
});

export type ReconcileSessionBody = z.infer<typeof reconcileSessionBodySchema>;

export const ordersRoutes = {
	createDomain: "/api/v1/orders/domain",
	byId: (orderId: string) => `/api/v1/orders/${orderId}`,
	reconcileSession: "/api/v1/orders/reconcile-session",
} as const;
