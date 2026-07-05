// Small UI state machines for the custom-domain flows. They live here so the
// modal/panel components share the same step vocabulary.

export const buyDomainSteps = [
	"search",
	"registrant",
	"confirm",
	"progress",
	"success",
	"failed",
] as const;

export type BuyDomainStep = (typeof buyDomainSteps)[number];

export const externalDomainSteps = [
	"input",
	"records",
	"checking",
	"success",
] as const;

export type ExternalDomainStep = (typeof externalDomainSteps)[number];
