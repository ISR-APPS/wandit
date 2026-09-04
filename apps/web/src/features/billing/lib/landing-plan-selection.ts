import {
	type CreateBillingCheckoutBody,
	createBillingCheckoutBodySchema,
} from "@wandit/contracts";

export const LANDING_PLAN_SELECTION_STORAGE_KEY =
	"wandit-landing-plan-selection:v1";

export const landingPlanSelection = {
	stash(selection: CreateBillingCheckoutBody): void {
		const parsed = createBillingCheckoutBodySchema.safeParse(selection);
		if (!parsed.success) return;

		try {
			window.sessionStorage.setItem(
				LANDING_PLAN_SELECTION_STORAGE_KEY,
				JSON.stringify(parsed.data),
			);
		} catch {
			// Storage may be unavailable in hardened/private contexts.
		}
	},
	consume(): CreateBillingCheckoutBody | null {
		try {
			const stored = window.sessionStorage.getItem(
				LANDING_PLAN_SELECTION_STORAGE_KEY,
			);
			if (stored === null) return null;

			window.sessionStorage.removeItem(LANDING_PLAN_SELECTION_STORAGE_KEY);
			const parsedJson: unknown = JSON.parse(stored);
			const parsed = createBillingCheckoutBodySchema.safeParse(parsedJson);

			return parsed.success ? parsed.data : null;
		} catch {
			return null;
		}
	},
};
