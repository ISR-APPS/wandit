import {
	type AdminAiCostProvenance,
	adminAiCostProvenanceSchema,
} from "@wandit/contracts";

/** Defensive: an unexpected SQL label reads as the weakest provenance. */
export function normalizeCostProvenance(
	value: string | null | undefined,
): AdminAiCostProvenance {
	const parsed = adminAiCostProvenanceSchema.safeParse(value);

	return parsed.success ? parsed.data : "estimate";
}
