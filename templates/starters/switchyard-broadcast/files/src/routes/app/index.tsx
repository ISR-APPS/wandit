// Defines the protected dashboard index route.
// The /app layout checks the session before it renders this page.
import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "~/features/dashboard";

/** The dashboard overview shares the authenticated layout with the profile route. */
export const Route = createFileRoute("/app/")({ component: DashboardPage });
