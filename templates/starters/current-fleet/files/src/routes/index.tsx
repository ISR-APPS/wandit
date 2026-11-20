// Sends visitors to the application at its public entry point.
// The protected layout redirects signed-out visitors to sign-in.
import { createFileRoute, redirect } from "@tanstack/react-router";

/** Opens the app so the existing session decides which screen to show. */
export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: "/app" });
	},
});
