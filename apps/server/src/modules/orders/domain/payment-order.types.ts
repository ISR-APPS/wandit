import {
	domainNameSchema,
	domainPriceSnapshotSchema,
	domainTldSchema,
	registrantSchema,
	uuidSchema,
} from "@wandit/contracts";
import type { paymentOrders } from "@wandit/db/schema/orders";
import { z } from "zod";

export type PaymentOrderRow = typeof paymentOrders.$inferSelect;

export const domainRegistrationOrderMetadataSchema = z.object({
	domain: domainNameSchema,
	priceSnapshot: domainPriceSnapshotSchema,
	projectId: uuidSchema.optional(),
	registrant: registrantSchema,
	tld: domainTldSchema,
	whoisPrivacy: z.boolean(),
});

export type DomainRegistrationOrderMetadata = z.infer<
	typeof domainRegistrationOrderMetadataSchema
>;
