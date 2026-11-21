/**
 * Route of the wallet page at `/billing`. It reads `?starterPass=1`, which the native app links use.
 * The page then opens the top-up dialog once, and this route removes the flag from the URL.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";

import BillingPage from "@/features/billing/pages/billing-page";
import { pageTitle } from "@/lib/i18n";

// TanStack parses `?starterPass=1` as the number 1. Any other value is dropped.
const billingSearchSchema = z.object({
	starterPass: z.literal(1).optional().catch(undefined),
});

export const Route = createFileRoute("/_auth/billing")({
	validateSearch: (search: Record<string, unknown>) =>
		billingSearchSchema.parse(search),
	head: () => ({
		meta: [{ title: pageTitle("billing.meta.title") }],
	}),
	component: BillingRoute,
});

function BillingRoute() {
	const { starterPass } = Route.useSearch();
	const navigate = Route.useNavigate();
	const clearStarterPass = useCallback(() => {
		void navigate({ search: {}, replace: true });
	}, [navigate]);

	return (
		<BillingPage
			openTopupOnLoad={starterPass === 1}
			onTopupOpened={clearStarterPass}
		/>
	);
}
