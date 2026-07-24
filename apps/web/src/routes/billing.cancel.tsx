import { createFileRoute } from "@tanstack/react-router";

import BillingCancelPage from "@/features/billing/pages/billing-cancel-page";

export const Route = createFileRoute("/billing/cancel")({
	component: BillingCancelPage,
});
