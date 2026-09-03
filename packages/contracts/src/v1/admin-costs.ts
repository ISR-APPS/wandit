import { z } from "zod";
import { isoDateTimeSchema } from "./shared/primitives";

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export type MonthKey = z.infer<typeof monthKeySchema>;

const nonnegativeCentsSchema = z.number().int().min(0);
const positiveVersionSchema = z.int().positive();

const monthlyCostInputShape = {
	month: monthKeySchema,
	currency: z.string().min(1),
	adSpendBySourceCents: z.record(z.string().min(1), nonnegativeCentsSchema),
	infrastructureCostCents: nonnegativeCentsSchema,
	otherCostCents: nonnegativeCentsSchema,
	notes: z.string().nullable(),
};

export const monthlyCostEntrySchema = z.object({
	...monthlyCostInputShape,
	totalAdSpendCents: nonnegativeCentsSchema,
	totalCostCents: nonnegativeCentsSchema,
	version: positiveVersionSchema,
	updatedAt: isoDateTimeSchema,
});

export type MonthlyCostEntry = z.infer<typeof monthlyCostEntrySchema>;

export const listMonthlyCostsQuerySchema = z
	.object({
		fromMonth: monthKeySchema.optional(),
		toMonth: monthKeySchema.optional(),
	})
	.superRefine((query, context) => {
		if (
			query.fromMonth !== undefined &&
			query.toMonth !== undefined &&
			query.fromMonth > query.toMonth
		) {
			context.addIssue({
				code: "custom",
				message: "toMonth must be on or after fromMonth",
				path: ["toMonth"],
			});
		}
	});

export type ListMonthlyCostsQuery = z.infer<typeof listMonthlyCostsQuerySchema>;

export const createMonthlyCostRequestSchema = monthlyCostEntrySchema.omit({
	totalAdSpendCents: true,
	totalCostCents: true,
	version: true,
	updatedAt: true,
});

export type CreateMonthlyCostRequest = z.infer<
	typeof createMonthlyCostRequestSchema
>;

export const updateMonthlyCostRequestSchema = createMonthlyCostRequestSchema
	.omit({ month: true })
	.partial()
	.extend({ version: positiveVersionSchema })
	.refine((request) => Object.keys(request).some((key) => key !== "version"), {
		message: "At least one cost field must be provided",
	});

export type UpdateMonthlyCostRequest = z.infer<
	typeof updateMonthlyCostRequestSchema
>;

export const listMonthlyCostsResponseSchema = z.object({
	months: z.array(monthlyCostEntrySchema),
});

export type ListMonthlyCostsResponse = z.infer<
	typeof listMonthlyCostsResponseSchema
>;

export const monthlyCostResponseSchema = z.object({
	month: monthlyCostEntrySchema,
});

export type MonthlyCostResponse = z.infer<typeof monthlyCostResponseSchema>;

const adminCostsRoot = "/api/v1/admin/costs";

export const adminCostsRoutes = {
	collection: adminCostsRoot,
	month: (month: string) => `${adminCostsRoot}/${encodeURIComponent(month)}`,
} as const;
