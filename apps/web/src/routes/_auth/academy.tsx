import { createFileRoute, Outlet } from "@tanstack/react-router";

import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/academy")({
	head: () => ({
		meta: [{ title: pageTitle("academy.meta.title") }],
	}),
	component: Outlet,
});
