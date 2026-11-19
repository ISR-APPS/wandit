/**
 * Route of the /refer account page. The `_auth` parent already checked the session.
 * It sends the user to /dashboard while the user referral program is off.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

import { publicSettingsQuery } from "@/features/settings";
import ReferPage from "@/features/user-referrals/pages/refer-page";
import { pageTitle } from "@/lib/i18n";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/_auth/refer")({
	beforeLoad: async () => {
		// Product rule: the page exists only while the admin switch is on. The API answers 403 when it is off.
		const settings = await queryClient.ensureQueryData(publicSettingsQuery);
		if (!settings.userReferralsEnabled) {
			throw redirect({ to: "/dashboard", replace: true });
		}
	},
	head: () => ({
		meta: [{ title: pageTitle("userReferrals.meta.title") }],
	}),
	component: ReferPage,
});
