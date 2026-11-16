// The plans page behind login: one card per membership plan, the monthly value by plan, and the payments ahead.
// The /app/plans route renders it after its loader. The route also uses the skeleton and the error below.
// The active counts of the cards add up to the active members of the home and of the members list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { useNow } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	planSummariesQueryOptions,
	upcomingPaymentsQueryOptions,
} from "../api/plans.queries";
import { PlanCard } from "./plan-card";
import { RevenueMixCard } from "./revenue-mix-card";
import { UpcomingPaymentsCard } from "./upcoming-payments-card";

/** The five plan cards in one row from the 5xl container width, then the donut and the payments. */
export function PlansPage() {
	const { t } = useT();
	const now = useNow();
	const { data: summaries } = useSuspenseQuery(planSummariesQueryOptions());
	const { data: payments } = useSuspenseQuery(upcomingPaymentsQueryOptions());
	const activeTotal = summaries.reduce((sum, row) => sum + row.activeCount, 0);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("plans.title")}
				description={t("plans.description")}
			/>
			{/* Five cards fill a row of 5 from 64rem. Below it, 2 wide cards sit above 3: no empty cell. */}
			<ul className="grid @2xl/main:grid-cols-6 @5xl/main:grid-cols-5 grid-cols-1 gap-4">
				{summaries.map((summary, index) => (
					<li
						key={summary.plan.id}
						className={cn(
							"@5xl/main:col-span-1 min-w-0",
							index < 2 ? "@2xl/main:col-span-3" : "@2xl/main:col-span-2",
						)}
					>
						<PlanCard summary={summary} activeTotal={activeTotal} />
					</li>
				))}
			</ul>
			{/* No items-start: the donut card stretches to the height of the payments card, so no empty block shows. */}
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 gap-6">
				<RevenueMixCard summaries={summaries} />
				<UpcomingPaymentsCard
					payments={payments}
					now={now}
					className="@5xl/main:col-span-2"
				/>
			</div>
		</div>
	);
}

// Placeholder cards of the skeleton. Fixed keys, because the cards never reorder.
const SKELETON_CARDS = ["1", "2", "3", "4", "5"];

/** Placeholder while the plans loader runs: the header, the five cards, and the two panels. */
export function PlansPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<div className="grid @2xl/main:grid-cols-2 @5xl/main:grid-cols-5 grid-cols-1 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-96" />
				))}
			</div>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<Skeleton className="h-96" />
				<Skeleton className="@5xl/main:col-span-2 h-96" />
			</div>
		</div>
	);
}

/** Error state of the plans page when the loader fails. Try again runs the loader again. */
export function PlansPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("plans.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
