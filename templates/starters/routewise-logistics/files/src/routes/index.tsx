// The / route of an internal tool. It has no page: it sends every visitor to the app area.
// The /app layout then sends a signed-out visitor to /login.
import { createFileRoute, redirect } from "@tanstack/react-router";

/** The route stays: the build crawls from /. */
export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: "/app" });
	},
});
