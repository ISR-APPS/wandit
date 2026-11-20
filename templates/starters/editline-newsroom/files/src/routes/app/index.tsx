// Renders the Editline index view.
// The parent app route checks the session before this view renders.
import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "~/features/dashboard";

/** Inherits the shared Supabase session from /app. */
export const Route = createFileRoute("/app/")({ component: DashboardPage });
