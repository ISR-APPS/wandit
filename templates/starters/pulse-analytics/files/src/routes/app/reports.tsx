// The Reports page behind login. The /app layout checks the session first.
// The loader fills the four reports. Thin: the page and its states live in the reports feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DEFAULT_FUNNEL_DAYS,
	funnelQueryOptions,
	platformPeopleQueryOptions,
	ReportsPage,
	ReportsPageError,
	ReportsPageSkeleton,
	retentionQueryOptions,
	signUpsByChannelQueryOptions,
} from "~/features/reports";

/** /app/reports: retention, the activation funnel, sign-ups by channel, and platforms. */
export const Route = createFileRoute("/app/reports")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(retentionQueryOptions()),
			context.queryClient.query(funnelQueryOptions(DEFAULT_FUNNEL_DAYS)),
			context.queryClient.query(signUpsByChannelQueryOptions()),
			context.queryClient.query(platformPeopleQueryOptions()),
		]),
	pendingComponent: ReportsPageSkeleton,
	errorComponent: ReportsPageError,
	component: ReportsPage,
});
