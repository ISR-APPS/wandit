import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	beforeLoad: () => {
		// The /_dashboard guard bounces unauthenticated users to /login.
		throw redirect({ to: "/dashboard" });
	},
});
