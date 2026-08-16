import { createFileRoute } from "@tanstack/react-router";

import { MonthlyCostsPage } from "@/features/costs/pages/monthly-costs-page";

export const Route = createFileRoute("/_dashboard/costs")({
	component: MonthlyCostsPage,
	head: () => ({
		meta: [{ title: "Monthly costs | Wandit Admin" }],
	}),
});
