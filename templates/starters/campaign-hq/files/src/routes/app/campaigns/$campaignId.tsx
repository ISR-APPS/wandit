// The page of one campaign. The /app layout checks the session first.
// The loader fills the campaign cache. Thin: the page lives in the campaigns feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	CampaignDetailPage,
	CampaignDetailPageSkeleton,
	CampaignsPageError,
	campaignQueryOptions,
} from "~/features/campaigns";

/** /app/campaigns/$campaignId. The param is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/campaigns/$campaignId")({
	loader: ({ context, params }) =>
		context.queryClient.query(campaignQueryOptions(params.campaignId)),
	pendingComponent: CampaignDetailPageSkeleton,
	errorComponent: CampaignsPageError,
	component: CampaignDetailRoute,
});

function CampaignDetailRoute() {
	const { campaignId } = Route.useParams();
	return <CampaignDetailPage campaignId={campaignId} />;
}
