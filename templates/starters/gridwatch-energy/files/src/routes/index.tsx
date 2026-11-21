// Opens the workspace at the site root.
// The app layout sends visitors without a session to the login page.
import { createFileRoute, redirect } from "@tanstack/react-router";

/** The build uses this route to enter the app. */
export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: "/app" });
	},
});
