// The campaign list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the campaigns feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	CampaignsPage,
	CampaignsPageError,
	CampaignsPageSkeleton,
	campaignsQueryOptions,
	campaignsSearchSchema,
} from "~/features/campaigns";

/** /app/campaigns: every campaign. `?status=` opens one status tab, `?channel=` filters by channel. */
export const Route = createFileRoute("/app/campaigns/")({
	validateSearch: campaignsSearchSchema,
	loader: ({ context }) => context.queryClient.query(campaignsQueryOptions()),
	pendingComponent: CampaignsPageSkeleton,
	errorComponent: CampaignsPageError,
	component: CampaignsPage,
});
