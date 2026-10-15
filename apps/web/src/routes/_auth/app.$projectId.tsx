/**
 * Route of the V2 app builder at `/app/$projectId`.
 * Sends the user to `/dashboard` when V2 is closed, for example on production.
 * Validates the search params, fills the project query before the page
 * renders, warms the turn estimate and the Code view cache, and lazy-loads
 * the page chunk. The `/_auth` parent already checked the session.
 * A build without V2 (the Vercel production build) keeps only the search
 * parse and the redirect. `__V2_BUILDER_IN_BUILD__` removes the rest.
 */

import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import Loader from "@/components/loader";
import {
	AppNotFound,
	appBuilderSearchSchema,
	appProjectQuery,
	codeSnapshotQuery,
	turnEstimateQuery,
} from "@/features/app-builder";
import { publicSettingsQuery } from "@/features/settings";
import { pageTitle } from "@/lib/i18n";
import { queryClient } from "@/lib/query-client";

// The builder is a heavy chunk. `/` and `/dashboard` stay light.
// A build without V2 has no page, so the bundler removes the chunk.
const AppBuilderPage = __V2_BUILDER_IN_BUILD__
	? lazy(() => import("@/features/app-builder/pages/app-builder-page"))
	: null;

export const Route = createFileRoute("/_auth/app/$projectId")({
	validateSearch: (search: Record<string, unknown>) =>
		appBuilderSearchSchema.parse(search),
	beforeLoad: async () => {
		// Product rule: V2 is open on staging only. A build without V2 redirects
		// at once. The production API also answers false here.
		const isV2Open =
			__V2_BUILDER_IN_BUILD__ &&
			(await queryClient.ensureQueryData(publicSettingsQuery)).v2BuilderEnabled;
		if (!isV2Open) {
			throw redirect({ to: "/dashboard", replace: true });
		}
	},
	loader: async ({ params }) => {
		// beforeLoad redirects a build without V2 first. This return removes the V2 queries from that build.
		if (!__V2_BUILDER_IN_BUILD__) {
			return;
		}
		const project = await queryClient.ensureQueryData(
			appProjectQuery(params.projectId),
		);
		if (!project) throw notFound();
		// The composer and the Code view read these later. Warm them now without holding the first paint.
		void queryClient.prefetchQuery(turnEstimateQuery(params.projectId));
		void queryClient.prefetchQuery(codeSnapshotQuery(params.projectId));
	},
	head: () => ({ meta: [{ title: pageTitle("appBuilder.meta.title") }] }),
	// A build without V2 never throws notFound here, because beforeLoad redirects first.
	// The router plugin still makes a lazy chunk that exports undefined. That chunk never loads.
	notFoundComponent: __V2_BUILDER_IN_BUILD__ ? AppNotFound : undefined,
	component: RouteComponent,
});

function RouteComponent() {
	const { projectId } = Route.useParams();
	const search = Route.useSearch();
	return (
		<Suspense fallback={<Loader />}>
			{AppBuilderPage ? (
				<AppBuilderPage projectId={projectId} search={search} />
			) : null}
		</Suspense>
	);
}
