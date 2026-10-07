// Public surface consumed by other features. Pages are never exported from barrels.

// The subscription view of the active workspace; the dashboard and the V1 create read the plan from it.
// The local pricing of the visitor: DZD and SlickPay for Algeria, null for all other visitors.
export {
	useBillingSubscriptionQuery,
	useLocalPricingQuery,
} from "./api/billing.queries";
// Opens the plan picker. The landing pricing page and the create-team dialog call it.
export { useBillingModal } from "./components/billing-modal-provider";
// Opens the credits dialog for a 402 answer; the V2 builder chat calls it.
export { dispatchBillingError } from "./lib/billing-error-dispatch";
// Price text for visitors in Algeria (DZD) and for all other visitors (USD).
export {
	formatPlanPrice,
	tierPriceUsd,
	tierSavingsPercent,
} from "./lib/plan-pricing";
