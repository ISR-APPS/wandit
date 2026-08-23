import { createFileRoute } from "@tanstack/react-router";

import { OfflineBillingPage } from "@/features/offline-billing/pages/offline-billing-page";

export const Route = createFileRoute("/_dashboard/offline-billing")({
	component: OfflineBillingPage,
	head: () => ({
		meta: [{ title: "Offline billing | Wandit Admin" }],
	}),
});
