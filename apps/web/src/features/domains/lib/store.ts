// Small UI state machines for the custom-domain flows. They live here so the
// modal/panel components share the same step vocabulary.

// Purchase ends with a redirect to Stripe Checkout; post-payment progress
// lives on the billing return pages, not in this dialog.
export const buyDomainSteps = ["search", "registrant", "confirm"] as const;

export type BuyDomainStep = (typeof buyDomainSteps)[number];

export const externalDomainSteps = [
	"input",
	"records",
	"checking",
	"success",
] as const;

export type ExternalDomainStep = (typeof externalDomainSteps)[number];
