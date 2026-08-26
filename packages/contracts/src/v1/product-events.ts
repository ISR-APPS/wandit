import { z } from "zod";

export const productEventKindSchema = z.enum([
	"pricing_viewed",
	"upgrade_clicked",
]);

export type ProductEventKind = z.infer<typeof productEventKindSchema>;

export const productEventSurfaceSchema = z.enum([
	"marketing_pricing",
	"plan_picker",
	"workspace_header",
	"sidebar",
	"billing_page",
	"out_of_credits",
	"insufficient_credits",
	"credits_chip",
	"generate_page",
	"create_workspace",
]);

export type ProductEventSurface = z.infer<typeof productEventSurfaceSchema>;

export const productEventMethodSchema = z.enum(["card", "offline"]);

export type ProductEventMethod = z.infer<typeof productEventMethodSchema>;

export const productEventPropertiesSchema = z.object({
	method: productEventMethodSchema.optional(),
});

export type ProductEventProperties = z.infer<
	typeof productEventPropertiesSchema
>;

export const createProductEventRequestSchema = z
	.object({
		idempotencyKey: z.string().uuid(),
		kind: productEventKindSchema,
		properties: productEventPropertiesSchema.optional(),
		surface: productEventSurfaceSchema,
	})
	.superRefine((request, context) => {
		if (
			request.kind === "upgrade_clicked" &&
			request.properties?.method === undefined
		) {
			context.addIssue({
				code: "custom",
				message: "method is required when kind is upgrade_clicked",
				path: ["properties", "method"],
			});
		}
	});

export type CreateProductEventRequest = z.infer<
	typeof createProductEventRequestSchema
>;

export const PRODUCT_EVENTS_ROUTES = {
	create: "/v1/product-events",
} as const;
