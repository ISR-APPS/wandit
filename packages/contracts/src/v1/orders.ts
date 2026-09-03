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

const checkoutReturnPathSchema = z
	.string()
	.max(2048)
	.startsWith("/")
	.refine((path) => !path.startsWith("//"), {
		message: "Return path must not include a host",
	})
	.refine((path) => !path.includes("\\"), {
		message: "Return path must not contain backslashes",
	})
	.refine((path) => !/\p{Cc}/u.test(path), {
		message: "Return path must not contain control characters",
	});

export const createDomainOrderBodySchema = z.object({
	domain: domainNameSchema,
	registrant: registrantSchema,
	projectId: uuidSchema.optional(),
	returnPath: checkoutReturnPathSchema.optional(),
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
	// The project the purchase belongs to, so return pages can route back into
	// the workspace instead of dead-ending at the dashboard.
	projectId: uuidSchema.nullable(),
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
