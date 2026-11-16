// The page of one rep: the header with the pace, the quarter facts, the weekly chart, the attainment,
// the product mix, the top accounts, the last four quarters, and the orders of the quarter.
// The /app/reps/$repId route renders it after its loader. An unknown id shows a not-found block.
import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { PaceBadge, RepAvatar } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { repQueryOptions } from "../api/reps.queries";
import { RepAccountsCard } from "./rep-accounts-card";
import { RepAttainmentCard } from "./rep-attainment-card";
import { RepHistoryCard } from "./rep-history-card";
import { RepMixCard } from "./rep-mix-card";
import { RepOrdersCard } from "./rep-orders-card";
import { RepQuarterCard } from "./rep-quarter-card";
import { RepWeeklyCard } from "./rep-weekly-card";

type RepDetailPageProps = {
	/** The `$repId` param of the URL. An id that is not in the team shows the not-found block. */
	repId: string;
};

/** One column on a phone, two from the 2xl main width, and rows of 2/3 + 1/3 and 1/2 + 1/2 from 4xl. */
export function RepDetailPage({ repId }: RepDetailPageProps) {
	const { t } = useT();
	const { data: rep } = useSuspenseQuery(repQueryOptions(repId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/reps">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("reps.title")}
			</Link>
		</Button>
	);
	if (!rep) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">{t("reps.notFound")}</p>
			</div>
		);
	}

	return (
		<div className="grid gap-6">
			{backLink}
			<div className="flex flex-wrap items-center gap-4">
				<RepAvatar name={rep.name} className="size-14 [&>span]:text-lg" />
				<div className="min-w-0 flex-1">
					<PageHeader
						title={rep.name}
						description={
							<span className="flex flex-wrap items-center gap-2">
								<PaceBadge status={rep.status} />
								<span>{`${rep.territoryName} · ${t(`roles.${rep.role}`)}`}</span>
							</span>
						}
						actions={
							<Button asChild variant="outline">
								<a href={`mailto:${rep.email}`}>
									<EnvelopeSimpleIcon />
									{t("reps.email")}
								</a>
							</Button>
						}
					/>
				</div>
			</div>
			{/* Each card sits in a one-cell grid, so it fills the height of its row. */}
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-6 gap-6 *:grid *:min-w-0">
				{/* The quarter facts and the weeks come first at every width. */}
				<div className="@2xl/main:col-span-2 @4xl/main:col-span-4">
					<RepQuarterCard rep={rep} />
				</div>
				<div className="@2xl/main:col-span-2 @4xl/main:col-span-4">
					<RepWeeklyCard weeks={rep.weeks} />
				</div>
				{/* On a wide page these two sit beside the facts and the weeks, in the last third. */}
				<div className="@4xl/main:col-span-2 @4xl/main:col-start-5 @4xl/main:row-start-1">
					<RepAttainmentCard rep={rep} />
				</div>
				<div className="@4xl/main:col-span-2 @4xl/main:col-start-5 @4xl/main:row-start-2">
					<RepMixCard productMix={rep.productMix} />
				</div>
				<div className="@4xl/main:col-span-3">
					<RepAccountsCard accounts={rep.topAccounts} />
				</div>
				<div className="@4xl/main:col-span-3">
					<RepHistoryCard history={rep.history} />
				</div>
				{/* The long orders table comes last, across the page, so no column ends far above it. */}
				<div className="@2xl/main:col-span-2 @4xl/main:col-span-6">
					<RepOrdersCard orders={rep.quarterOrders} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the rep loader runs. The route sets it as pendingComponent. */
export function RepDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-40" />
			<div className="flex items-center gap-4">
				<Skeleton className="size-14 rounded-full" />
				<div className="grid gap-2">
					<Skeleton className="h-8 w-56" />
					<Skeleton className="h-5 w-48" />
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-6 gap-6">
				<Skeleton className="@4xl/main:col-span-4 h-48" />
				<Skeleton className="@4xl/main:col-span-2 h-48" />
				<Skeleton className="@4xl/main:col-span-4 h-80" />
				<Skeleton className="@4xl/main:col-span-2 h-80" />
			</div>
		</div>
	);
}
