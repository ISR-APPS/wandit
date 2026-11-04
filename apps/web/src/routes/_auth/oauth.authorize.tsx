/**
 * Route of the OAuth login bridge at /oauth/authorize, the `loginPage` of `@wandit/auth`.
 * The `_auth` parent runs the sign-in and onboarding gates first and keeps the raw query in `next`.
 * No validateSearch: the page reads the raw query, which the API signed.
 */
import { createFileRoute } from "@tanstack/react-router";

import OAuthAuthorizePage from "@/features/coding-agents/pages/oauth-authorize-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/oauth/authorize")({
	head: () => ({
		meta: [{ title: pageTitle("auth.codingAgents.authorize.metaTitle") }],
	}),
	component: OAuthAuthorizePage,
});
