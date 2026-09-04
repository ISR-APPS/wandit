import type { BillingPlanId } from "@wandit/contracts";
import type { Dictionary } from "@wandit/internationalization";

type PlanPickerCopy = Pick<
	Dictionary["billing"]["planPicker"],
	| "starterName"
	| "starterTagline"
	| "starterFeatures"
	| "proName"
	| "proTagline"
	| "proFeatures"
	| "businessName"
	| "businessTagline"
	| "businessFeatures"
>;

export type BillingPlanCopy = {
	features: readonly string[];
	name: string;
	tagline: string;
};

export function getBillingPlanCopy(
	planId: BillingPlanId,
	copy: PlanPickerCopy,
): BillingPlanCopy {
	const copyByPlan = {
		starter: {
			features: copy.starterFeatures,
			name: copy.starterName,
			tagline: copy.starterTagline,
		},
		pro: {
			features: copy.proFeatures,
			name: copy.proName,
			tagline: copy.proTagline,
		},
		business: {
			features: copy.businessFeatures,
			name: copy.businessName,
			tagline: copy.businessTagline,
		},
	} satisfies Record<BillingPlanId, BillingPlanCopy>;

	return copyByPlan[planId];
}

export function getBillingPlanName(
	planId: BillingPlanId,
	copy: PlanPickerCopy,
): string {
	return getBillingPlanCopy(planId, copy).name;
}
