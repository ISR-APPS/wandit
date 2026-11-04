/**
 * Route of the OAuth consent page at /oauth/consent, the `consentPage` of `@wandit/auth`.
 * The `_auth` parent runs the sign-in and onboarding gates first and keeps the raw query in `next`.
 * No validateSearch: the page reads the raw query, which the API signed. The route gives the page the gate user.
 */
import { createFileRoute } from "@tanstack/react-router";

import OAuthConsentPage from "@/features/coding-agents/pages/oauth-consent-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/oauth/consent")({
	head: () => ({
		meta: [{ title: pageTitle("auth.codingAgents.consent.metaTitle") }],
	}),
	component: OAuthConsentRoute,
});

function OAuthConsentRoute() {
	// The `_auth` gate loaded the session before this render, so the email shows before Allow is active.
	const { session } = Route.useRouteContext();
	return <OAuthConsentPage initialUser={session.user} />;
}
