// The page of one campaign: the title and the calendar link, then the tabs Overview, Content, and Activity.
// The /app/campaigns/$campaignId route renders it after its loader. An unknown id shows a not-found block.
// It follows the kit profile page: a 1/3 column of profile cards and a 2/3 column of activity, chart, and lists.
import { CalendarDotsIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { campaignQueryOptions } from "../api/campaigns.queries";
import { CampaignActivityCard } from "./campaign-activity-card";
import { CampaignAudiencesCard } from "./campaign-audiences-card";
import { CampaignBudgetCard } from "./campaign-budget-card";
import { CampaignChannelsCard } from "./campaign-channels-card";
import { CampaignContentCard } from "./campaign-content-card";
import { CampaignProfileCard } from "./campaign-profile-card";
import { CampaignSpendCard } from "./campaign-spend-card";

// The Overview tab shows this many events and content items. The other tabs show all of them.
const OVERVIEW_EVENTS = 3;
const OVERVIEW_CONTENT = 6;

/** The three tabs of the page. Each one is a real view of the same campaign. */
const TABS = ["overview", "content", "activity"] as const;
type DetailTab = (typeof TABS)[number];

type CampaignDetailPageProps = {
	/** The `$campaignId` param of the URL. An unknown id shows the not-found block. */
	campaignId: string;
};

/** The two columns start at the 5xl container width (64rem). Below it, the cards stack in one column. */
export function CampaignDetailPage({ campaignId }: CampaignDetailPageProps) {
	const { t } = useT();
	const { data: campaign } = useSuspenseQuery(campaignQueryOptions(campaignId));
	const [tab, setTab] = useState<DetailTab>("overview");

	if (!campaign) {
		return (
			<div className="grid justify-items-start gap-4">
				<p className="text-muted-foreground text-sm">
					{t("campaigns.notFound")}
				</p>
				<Button asChild variant="outline">
					<Link to="/app/campaigns">
						<CaretLeftIcon className="rtl:rotate-180" />
						{t("campaigns.back")}
					</Link>
				</Button>
			</div>
		);
	}

	const now = Date.now();
	const hasResults = campaign.dailySpend.length > 0;

	return (
		<div className="grid gap-4">
			<PageHeader
				title={campaign.name}
				actions={
					<Button asChild>
						<Link to="/app/calendar" search={{ campaign: campaign.id }}>
							<CalendarDotsIcon />
							{t("campaigns.openCalendar")}
						</Link>
					</Button>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) => {
					const next = TABS.find((name) => name === value);
					if (next) {
						setTab(next);
					}
				}}
				className="gap-4"
			>
				<TabsList>
					{TABS.map((name) => (
						<TabsTrigger key={name} value={name}>
							{t(`campaigns.tabs.${name}`)}
						</TabsTrigger>
					))}
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @5xl/main:grid-cols-3 items-start gap-4">
						<div className="grid min-w-0 gap-4">
							<CampaignProfileCard campaign={campaign} />
							<CampaignBudgetCard campaign={campaign} />
							<CampaignChannelsCard campaign={campaign} />
						</div>
						<div className="@5xl/main:col-span-2 grid min-w-0 gap-4">
							<CampaignActivityCard
								campaign={campaign}
								now={now}
								limit={OVERVIEW_EVENTS}
								onViewAll={() => setTab("activity")}
							/>
							{hasResults ? <CampaignSpendCard campaign={campaign} /> : null}
							<div className="grid @5xl/main:grid-cols-2 gap-4">
								<CampaignContentCard
									campaign={campaign}
									now={now}
									limit={OVERVIEW_CONTENT}
								/>
								<CampaignAudiencesCard campaign={campaign} />
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="content">
					<CampaignContentCard campaign={campaign} now={now} />
				</TabsContent>
				<TabsContent value="activity">
					<CampaignActivityCard campaign={campaign} now={now} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function CampaignDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-4">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-9 w-40" />
			</div>
			<Skeleton className="h-9 w-72" />
			<div className="grid @5xl/main:grid-cols-3 items-start gap-4">
				<div className="grid gap-4">
					<Skeleton className="h-[30rem] rounded-surface" />
					<Skeleton className="h-28 rounded-surface" />
				</div>
				<div className="@5xl/main:col-span-2 grid gap-4">
					<Skeleton className="h-80 rounded-surface" />
					<Skeleton className="h-80 rounded-surface" />
				</div>
			</div>
		</div>
	);
}
