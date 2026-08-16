import type {
	CreateMonthlyCostRequest,
	MonthlyCostEntry,
} from "@wandit/contracts";
import {
	createMonthlyCostRequestSchema,
	monthKeySchema,
	updateMonthlyCostRequestSchema,
} from "@wandit/contracts";
import { z } from "zod";

export const SUGGESTED_COST_SOURCE_KEYS = [
	"google",
	"meta",
	"tiktok",
	"affiliate",
	"organic_search",
	"referral",
	"direct",
	"linkedin",
	"youtube",
	"unknown",
	"unallocated",
] as const;

export type SourceSpendFormRow = {
	id: string;
	source: string;
	dollars: string;
};

export type MonthlyCostFormValues = {
	month: string;
	currency: string;
	sourceRows: SourceSpendFormRow[];
	infrastructureDollars: string;
	otherDollars: string;
	notes: string;
};

const dollarInputSchema = z
	.string()
	.trim()
	.min(1, "Enter a dollar amount.")
	.regex(/^\d+(?:\.\d{1,2})?$/, "Use dollars with at most two decimals.")
	.transform((value) => {
		const [whole = "0", fractional = ""] = value.split(".");
		return Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
	})
	.refine(Number.isSafeInteger, "The dollar amount is too large.");

const sourceSpendFormRowSchema = z.object({
	id: z.string(),
	source: z
		.string()
		.trim()
		.min(1, "Enter a source key.")
		.transform((value) => value.toLowerCase()),
	dollars: dollarInputSchema,
});

export const monthlyCostFormSchema = z
	.object({
		month: monthKeySchema,
		currency: z.string().trim().min(1),
		sourceRows: z.array(sourceSpendFormRowSchema),
		infrastructureDollars: dollarInputSchema,
		otherDollars: dollarInputSchema,
		notes: z.string(),
	})
	.superRefine((values, context) => {
		const firstRowBySource = new Map<string, number>();

		values.sourceRows.forEach((row, index) => {
			const firstIndex = firstRowBySource.get(row.source);
			if (firstIndex !== undefined) {
				context.addIssue({
					code: "custom",
					message: "Each source key can appear only once.",
					path: ["sourceRows", index, "source"],
				});
				return;
			}

			firstRowBySource.set(row.source, index);
		});
	})
	.transform(
		(values): CreateMonthlyCostRequest => ({
			month: values.month,
			currency: values.currency.toLowerCase(),
			adSpendBySourceCents: Object.fromEntries(
				values.sourceRows.map((row) => [row.source, row.dollars]),
			),
			infrastructureCostCents: values.infrastructureDollars,
			otherCostCents: values.otherDollars,
			notes: values.notes.trim() || null,
		}),
	)
	.pipe(createMonthlyCostRequestSchema);

export function centsToDollarInput(cents: number): string {
	return (cents / 100).toFixed(2);
}

export function monthlyCostFormValuesFromEntry(
	entry?: MonthlyCostEntry,
): MonthlyCostFormValues {
	return {
		month: entry?.month ?? "",
		currency: entry?.currency ?? "usd",
		sourceRows: Object.entries(entry?.adSpendBySourceCents ?? {}).map(
			([source, cents], index) => ({
				id: `existing-source-${index}`,
				source,
				dollars: centsToDollarInput(cents),
			}),
		),
		infrastructureDollars: centsToDollarInput(
			entry?.infrastructureCostCents ?? 0,
		),
		otherDollars: centsToDollarInput(entry?.otherCostCents ?? 0),
		notes: entry?.notes ?? "",
	};
}

export function toMonthlyCostUpdateRequest(
	input: CreateMonthlyCostRequest,
	version: number,
) {
	const { month: _month, ...fields } = input;

	return updateMonthlyCostRequestSchema.safeParse({
		...fields,
		version,
	});
}

export function formIssueMessage(
	error: z.ZodError,
	path: readonly (string | number)[],
): string | undefined {
	return error.issues.find(
		(issue) =>
			issue.path.length === path.length &&
			issue.path.every((part, index) => part === path[index]),
	)?.message;
}
