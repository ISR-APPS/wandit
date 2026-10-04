// Public landing route. Prerendered at build time.
// Thin: the page lives in the landing feature.
import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "~/features/landing";

export const Route = createFileRoute("/")({
	component: LandingPage,
});
