/**
 * Route of the V2 app builder at `/app/$projectId`.
 * Validates the search params, fills the project and thread queries before
 * the page renders, warms the caches of the other views, and lazy-loads
 * the page chunk. The `/_auth` parent already checked the session.
 */

import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import Loader from "@/components/loader";
import {
	AppNotFound,
	appBuilderSearchSchema,
	appProjectQuery,
	appStoresSummaryQuery,
	backendSummaryQuery,
	builderThreadQuery,
	codeSnapshotQuery,
	paymentsSummaryQuery,
	projectDomainsQuery,
	projectSettingsQuery,
	signInSummaryQuery,
} from "@/features/app-builder";
import { pageTitle } from "@/lib/i18n";
import { queryClient } from "@/lib/query-client";

// The builder is a heavy chunk. `/` and `/dashboard` stay light.
const AppBuilderPage = lazy(
	() => import("@/features/app-builder/pages/app-builder-page"),
);

export const Route = createFileRoute("/_auth/app/$projectId")({
	validateSearch: (search: Record<string, unknown>) =>
		appBuilderSearchSchema.parse(search),
	loader: async ({ params }) => {
		const project = await queryClient.ensureQueryData(
			appProjectQuery(params.projectId),
		);
		if (!project) throw notFound();
		await queryClient.ensureQueryData(builderThreadQuery(params.projectId));
		// The other views read these later. Warm them now without holding the first paint.
		void queryClient.prefetchQuery(codeSnapshotQuery(params.projectId));
		void queryClient.prefetchQuery(backendSummaryQuery(params.projectId));
		void queryClient.prefetchQuery(signInSummaryQuery(params.projectId));
		void queryClient.prefetchQuery(paymentsSummaryQuery(params.projectId));
		void queryClient.prefetchQuery(projectSettingsQuery(params.projectId));
		if (project.kind === "web") {
			void queryClient.prefetchQuery(projectDomainsQuery(params.projectId));
		} else {
			void queryClient.prefetchQuery(appStoresSummaryQuery(params.projectId));
		}
	},
	head: () => ({ meta: [{ title: pageTitle("appBuilder.meta.title") }] }),
	notFoundComponent: AppNotFound,
	component: RouteComponent,
});

function RouteComponent() {
	const { projectId } = Route.useParams();
	const search = Route.useSearch();
	return (
		<Suspense fallback={<Loader />}>
			<AppBuilderPage projectId={projectId} search={search} />
		</Suspense>
	);
}
