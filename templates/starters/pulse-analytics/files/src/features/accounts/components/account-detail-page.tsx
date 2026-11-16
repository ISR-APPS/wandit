// The page of one account: its header and status, the activity, the most active people, the facts, the features, and the timeline.
// The /app/accounts/$accountId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { fillMessage, TOUCH_AREA } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { accountQueryOptions } from "../api/accounts.queries";
import { ACCOUNT_STATUS_BADGE } from "../lib/account-status";
import { AccountActivityCard } from "./account-activity-card";
import { AccountFactsCard } from "./account-facts-card";
import { AccountFeaturesCard } from "./account-features-card";
import { AccountPeopleCard } from "./account-people-card";
import { AccountTimelineCard } from "./account-timeline-card";

/** A 2/3 main column and a 1/3 rail from the 4xl container width. */
const DETAIL_GRID = "grid grid-cols-1 items-start gap-6 @4xl/main:grid-cols-3";
/** The rail cards: two columns from the 2xl container width, one column beside the main column from 4xl. */
const RAIL_GRID =
	"grid grid-cols-1 items-start gap-6 @2xl/main:grid-cols-2 @4xl/main:grid-cols-1";

type AccountDetailPageProps = {
	/** The `$accountId` param of the URL. The query treats an unknown id as not found. */
	accountId: string;
};

/** The detail page. Each card gets its data from the one account query, except the activity card, which holds a period. */
export function AccountDetailPage({ accountId }: AccountDetailPageProps) {
	const { t } = useT();
	const { data: account } = useSuspenseQuery(accountQueryOptions(accountId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className={cn("-ms-3 justify-self-start", TOUCH_AREA)}
		>
			<Link to="/app/accounts">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("accounts.title")}
			</Link>
		</Button>
	);
	if (!account) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("accounts.notFound")}
				</p>
			</div>
		);
	}

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={account.name}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<Badge variant={ACCOUNT_STATUS_BADGE[account.status]}>
							{t(`accounts.statuses.${account.status}`)}
						</Badge>
						<span>
							{fillMessage(t("accounts.planLine"), {
								plan: t(`plans.${account.plan}`),
								domain: account.domain,
							})}
						</span>
					</span>
				}
			/>
			<div className={DETAIL_GRID}>
				<div className="@4xl/main:col-span-2 grid grid-cols-1 gap-6">
					<AccountActivityCard
						// A new account starts from the default period.
						key={account.id}
						accountId={account.id}
						members={account.members}
					/>
					<AccountPeopleCard
						people={account.people}
						members={account.members}
					/>
				</div>
				<div className={RAIL_GRID}>
					<AccountFactsCard account={account} />
					<AccountFeaturesCard features={account.features} />
					<AccountTimelineCard
						timeline={account.timeline}
						plan={account.plan}
					/>
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function AccountDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-64 max-w-full" />
				<Skeleton className="h-5 w-56 max-w-full" />
			</div>
			<div className={DETAIL_GRID}>
				<div className="@4xl/main:col-span-2 grid grid-cols-1 gap-6">
					<Skeleton className="h-112" />
					<Skeleton className="h-96" />
				</div>
				<div className={RAIL_GRID}>
					<Skeleton className="h-80" />
					<Skeleton className="h-96" />
				</div>
			</div>
		</div>
	);
}
