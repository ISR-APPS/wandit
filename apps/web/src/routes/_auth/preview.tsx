// Launch-window teaser route, now RETIRED: the early-access gate was removed
// (2026-07-30) and every account generates for real. Stale tabs and
// bookmarks still hit this URL, so it redirects home instead of stranding
// users on a "Coming soon" that is no longer true. The teaser page component
// stays in the tree for the next launch window.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/preview")({
	beforeLoad: () => {
		throw redirect({ to: "/dashboard" });
	},
});
