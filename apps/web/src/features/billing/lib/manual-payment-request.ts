/**
 * Pure helpers for the offline payment request form.
 * Called by manual-payment-request-panel.tsx. Builds the body that the manual-request mutation sends.
 */
import type {
	CreateManualSubscriptionRequestBody,
	ManualBillingCountry,
	PreferredPaymentMethod,
} from "@wandit/contracts";

/** Form state of the contact form. assembleManualSubscriptionRequestBody turns an empty optional field into undefined. */
export type ManualPaymentContactValues = {
	fullName: string;
	phone: string;
	company: string;
	country: ManualBillingCountry;
	city: string;
	preferredPaymentMethod: PreferredPaymentMethod | "";
	notes: string;
};

/**
 * Builds the offline request body for a top-up of `amountUsd` whole USD.
 * The caller parses the result with createManualSubscriptionRequestBodySchema before the send.
 */
export function assembleManualSubscriptionRequestBody(
	amountUsd: number,
	contact: ManualPaymentContactValues,
): CreateManualSubscriptionRequestBody {
	return {
		amountUsd,
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
