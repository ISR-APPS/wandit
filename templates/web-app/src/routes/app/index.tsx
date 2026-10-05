// Index of /app: it sends the visitor to the profile page.
// The generated app replaces this file with its home page.
import { createFileRoute, redirect } from "@tanstack/react-router";

/** /app has no page of its own yet, so it opens the profile. */
export const Route = createFileRoute("/app/")({
	beforeLoad: () => {
		throw redirect({ to: "/app/profile" });
	},
});
