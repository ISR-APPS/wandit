import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "@/features/auth/lib/session";
import OnboardingPage from "@/features/onboarding/pages/onboarding-page";
import { sanitizeAuthRedirectPath } from "@/lib/auth-navigation";
import { pageTitle } from "@/lib/i18n";

type OnboardingSearch = {
	next?: string;
	/** Dev-only: re-open a completed onboarding (`/onboarding?replay=1`). */
	replay?: true;
};

export const Route = createFileRoute("/onboarding")({
	validateSearch: (search: Record<string, unknown>): OnboardingSearch => ({
		next:
			typeof search.next === "string"
				? sanitizeAuthRedirectPath(search.next)
				: undefined,
		...(import.meta.env.DEV && (search.replay === "1" || search.replay === true)
			? { replay: true }
			: {}),
	}),
	beforeLoad: async ({ location, search }) => {
		const session = await getSession();

		if (!session) {
			// Send the full onboarding URL (with its own ?next) as the auth
			// callback so a mid-flow re-login still ends at the deep link.
			throw redirect({
				to: "/",
				search: {
					auth: "required",
					next: sanitizeAuthRedirectPath(location.href) ?? "/onboarding",
				},
			});
		}

		if (session.user.onboardingCompletedAt && !search.replay) {
			throw redirect({ href: search.next ?? "/dashboard" });
		}

		return { session };
	},
	head: () => ({
		meta: [{ title: pageTitle("onboarding.meta.title") }],
	}),
	component: OnboardingRoute,
});

function OnboardingRoute() {
	const { session } = Route.useRouteContext();
	const { next } = Route.useSearch();

	return <OnboardingPage user={session.user} next={next} />;
}
