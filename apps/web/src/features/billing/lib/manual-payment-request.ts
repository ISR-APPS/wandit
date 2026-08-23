import type {
	BillingInterval,
	BillingPlanId,
	CreateManualSubscriptionRequestBody,
	CreditTier,
	ManualBillingCountry,
	ManualPaymentMethod,
} from "@wandit/contracts";

export type ManualPaymentContactValues = {
	fullName: string;
	phone: string;
	company: string;
	country: ManualBillingCountry;
	city: string;
	preferredPaymentMethod: ManualPaymentMethod | "";
	notes: string;
};

export type ManualRequestStep = "plan" | "contact";

const PLAN_STEP_FIELDS = new Set(["plan", "tierCredits", "interval"]);

// Plan-level issues send the user back to the plan step; everything else
// belongs to the contact step.
export function stepForInvalidFields(
	fields: readonly string[],
): ManualRequestStep {
	return fields.some((field) => PLAN_STEP_FIELDS.has(field))
		? "plan"
		: "contact";
}

export type ManualPaymentPlanSelection = {
	plan: BillingPlanId;
	tierCredits: CreditTier;
	interval: BillingInterval;
};

export function assembleManualSubscriptionRequestBody(
	selection: ManualPaymentPlanSelection,
	contact: ManualPaymentContactValues,
): CreateManualSubscriptionRequestBody {
	return {
		...selection,
		fullName: contact.fullName.trim(),
		phone: contact.phone.trim(),
		company: optionalTrimmed(contact.company),
		country: contact.country,
		city: optionalTrimmed(contact.city),
		preferredPaymentMethod: contact.preferredPaymentMethod || undefined,
		notes: optionalTrimmed(contact.notes),
	};
}

function optionalTrimmed(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}
