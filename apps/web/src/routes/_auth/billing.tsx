import { createFileRoute } from "@tanstack/react-router";

import BillingPage from "@/features/billing/pages/billing-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/billing")({
	head: () => ({
		meta: [{ title: pageTitle("billing.meta.title") }],
	}),
	component: BillingPage,
});
