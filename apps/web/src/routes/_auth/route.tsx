/**
 * Pathless `_auth` layout: the session gate and workspace hydrate of
 * every signed-in route. The router runs `beforeLoad` on each
 * navigation into it. The gate calls `getSession` and
 * `hydrateWorkspaceScope`. The layout renders the outlet and the
 * Chatwoot widget, except on the OAuth pages.
 */
import {
	createFileRoute,
	Outlet,
	redirect,
	useLocation,
} from "@tanstack/react-router";

import { getSession } from "@/features/auth";
import { ChatwootWidget } from "@/features/support";
import { hydrateWorkspaceScope } from "@/features/workspaces";
import {
	isOAuthPagePath,
	sanitizeAuthRedirectPath,
} from "@/lib/auth-navigation";

// The OAuth pages read the raw `window.location.search`. They work only while `__root` and `_auth`
// declare no validateSearch and no search middleware. With one, TanStack Router writes a
// re-serialized query to the URL on load, and the signature check can fail.
export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	beforeLoad: async ({ location }) => {
		// A failed session CHECK is not a signed-out user: swallowing it here
		// would eject a logged-in user to the landing page and drop their deep
		// link + stashed prompt. Rethrow with a readable message so the route
		// error screen (retryable) shows instead of a raw "Failed to fetch".
		const session = await getSession().catch((error) => {
			throw new Error("We could not check your session. Please retry.", {
				cause: error,
			});
		});
		// Stripe returns order reconciliation state in the query string. Keep
		// it across a re-authentication redirect. The API signs the query of an
		// OAuth page, and `location.href` is the router copy that breaks the
		// signature. The API sends the browser there with a full page load, so
		// `window.location` holds the raw URL.
		const next = sanitizeAuthRedirectPath(
			isOAuthPagePath(location.pathname)
				? `${window.location.pathname}${window.location.search}`
				: location.href,
		);
		if (!session) {
			throw redirect({
				to: "/",
				search: { auth: "required", next },
			});
		}
		if (!session.user.onboardingCompletedAt) {
			throw redirect({
				to: "/onboarding",
				search: { next },
			});
		}
		// Route loaders fetch before WorkspaceProvider mounts. The persisted
		// workspace must scope those requests, or a project of an organization
		// workspace answers 404.
		hydrateWorkspaceScope(session.user.id);
		return { session };
	},
});

function AuthLayout() {
	const userId = Route.useRouteContext({
		select: (context) => context.session?.user.id ?? null,
	});
	const isOAuthPage = useLocation({
		select: (location) => isOAuthPagePath(location.pathname),
	});
	return (
		<>
			<Outlet />
			{/* Live-chat bubble on every signed-in page; public routes stay clean.
			    The OAuth pages hold a signed request in the URL, and no third-party script may read it. */}
			{isOAuthPage ? null : <ChatwootWidget userId={userId} />}
		</>
	);
}
