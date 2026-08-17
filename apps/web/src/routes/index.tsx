import { createFileRoute, redirect } from "@tanstack/react-router";

import { getSession } from "@/features/auth/lib/session";
import LandingPage from "@/features/landing/pages/landing-page";
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
