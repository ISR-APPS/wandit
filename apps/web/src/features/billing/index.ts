// Public surface consumed by other features. Pages are never exported from barrels.

// The subscription view of the active workspace; the dashboard and the V1 create read the plan from it.
export { useBillingSubscriptionQuery } from "./api/billing.queries";
// Opens the credits dialog for a 402 answer; the V2 builder chat calls it.
export { dispatchBillingError } from "./lib/billing-error-dispatch";
