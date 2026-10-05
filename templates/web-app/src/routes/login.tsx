// Public sign-in route. The landing page and the /app guard open it.
// Thin: the form lives in the auth feature.
import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "~/features/auth";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});
