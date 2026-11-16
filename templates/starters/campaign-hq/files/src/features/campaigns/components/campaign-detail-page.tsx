// The page of one campaign: its header, its results, spend per day, results by channel, and content,
// with a rail for the budget, the details, and the timeline.
// The /app/campaigns/$campaignId route renders it after its loader. An unknown id shows a not-found block.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { CampaignStatusBadge } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { campaignQueryOptions } from "../api/campaigns.queries";
import { CampaignBudgetCard } from "./campaign-budget-card";
import { CampaignChannelsCard } from "./campaign-channels-card";
import { CampaignContentCard } from "./campaign-content-card";
import { CampaignDetailsCard } from "./campaign-details-card";
import { CampaignResultsCard } from "./campaign-results-card";
import { CampaignSpendCard } from "./campaign-spend-card";
import { CampaignTimelineCard } from "./campaign-timeline-card";

type CampaignDetailPageProps = {
	/** The `$campaignId` param of the URL. An unknown id shows the not-found block. */
	campaignId: string;
};

/**
 * A 2/3 main column and a 1/3 rail from the 4xl container width (56rem).
 * Below it, one column: the budget first, then the main cards, then the details and the timeline.
 */
export function CampaignDetailPage({ campaignId }: CampaignDetailPageProps) {
	const { t } = useT();
	const { data: campaign } = useSuspenseQuery(campaignQueryOptions(campaignId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start max-md:min-h-11"
		>
			<Link to="/app/campaigns">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("campaigns.back")}
			</Link>
		</Button>
	);
	if (!campaign) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("campaigns.notFound")}
				</p>
			</div>
		);
	}

	const now = Date.now();
	const hasResults = campaign.elapsedDays > 0;

	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				{backLink}
				<PageHeader
					title={campaign.name}
					description={
						<span className="flex flex-wrap items-center gap-2">
							<CampaignStatusBadge status={campaign.status} />
							<span dir="auto">{campaign.client}</span>
							<span aria-hidden="true">·</span>
							<span>{t(`objectives.${campaign.objective}`)}</span>
							<span aria-hidden="true">·</span>
							<span className="tabular-nums">{campaign.code}</span>
						</span>
					}
				/>
			</div>
			<div className="grid @4xl/main:grid-cols-3 items-start gap-6">
				<div className="@4xl/main:col-span-2 grid min-w-0 gap-6">
					<CampaignResultsCard campaign={campaign} />
					{hasResults ? <CampaignSpendCard campaign={campaign} /> : null}
					{hasResults ? <CampaignChannelsCard campaign={campaign} /> : null}
					<CampaignContentCard campaign={campaign} />
				</div>
				{/* In one column the rail has no box of its own, so the budget pace, the key fact, can go first. */}
				<div className="grid @max-4xl/main:contents min-w-0 gap-6">
					<div className="@max-4xl/main:order-first grid">
						<CampaignBudgetCard campaign={campaign} now={now} />
					</div>
					<CampaignDetailsCard campaign={campaign} />
					<CampaignTimelineCard campaign={campaign} now={now} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function CampaignDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-5 w-80" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 items-start gap-6">
				<div className="@4xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-36" />
					<Skeleton className="h-80" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-48" />
					<Skeleton className="h-64" />
				</div>
			</div>
		</div>
	);
}
