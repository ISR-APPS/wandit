/**
 * The route "/": the landing page for a visitor. A signed-in user goes to the dashboard or to onboarding.
 * TanStack Router calls `beforeLoad` before the page renders. It reads the session through `getSession`.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

import { getSession } from "@/features/auth/lib/session";
import LandingPage from "@/features/landing/pages/landing-page";
import { parseInviteCode } from "@/features/user-referrals";
import { sanitizeAuthRedirectPath } from "@/lib/auth-navigation";
import { pageTitle } from "@/lib/i18n";

type LandingSearch = {
	auth?: string;
	next?: string;
};

// The "/" beforeLoad blocks the marketing page's first paint, so the session
// probe may not hang on a cold or degraded API. Past this bound the landing
// page renders for everyone; a signed-in user then still has the header
// "Dashboard" link, only the automatic redirect is skipped.
const SESSION_PROBE_TIMEOUT_MS = 800;

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>): LandingSearch => ({
		auth: typeof search.auth === "string" ? search.auth : undefined,
		next:
			typeof search.next === "string"
				? sanitizeAuthRedirectPath(search.next)
				: undefined,
	}),
	beforeLoad: async ({ location, search }) => {
		// ?auth=required / ?auth=error must render the landing page — the modal
		// and error toast in landing-page.tsx depend on it.
		if (search.auth) return;
		// A section deep link (/#pricing from /pricing, the logo link) is a
		// deliberate visit to the marketing page — see use-section-nav.ts.
		if (location.hash) return;
		// An invite link of the user referral program stays on this page, also for a signed-in user.
		// UserReferralCapture in the root route claims the code and then removes the parameter.
		// That removal runs this function again, and the signed-in user then goes to the dashboard.
		// A parameter that is not a valid code does not stop the redirect: nothing removes it.
		if (parseInviteCode(location.searchStr) !== null) return;
		// A failed session CHECK is not a signed-out user (same reasoning as
		// routes/_auth/route.tsx): fall through to the landing page.
		const session = await Promise.race([
			getSession().catch(() => null),
			new Promise<null>((resolve) => {
				window.setTimeout(() => resolve(null), SESSION_PROBE_TIMEOUT_MS);
			}),
		]);
		if (!session) return;
		if (!session.user.onboardingCompletedAt) {
			throw redirect({
				to: "/onboarding",
				search: { next: search.next ?? "/dashboard" },
				replace: true,
			});
		}
		throw redirect({ href: search.next ?? "/dashboard", replace: true });
	},
	head: () => ({
		meta: [
			{ title: pageTitle("landing.meta.title") },
			{
				name: "description",
				content: pageTitle("landing.meta.description"),
			},
		],
	}),
	component: LandingPage,
});
