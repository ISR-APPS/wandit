# Home bento

KPIs, then a 12-column grid of cards with different sizes and kinds.
The grid holds the trend beside one breakdown, then three small tiles.

## Needs

A trend, a breakdown, a ranked list, and recent events. Each tile shows a different kind of data.

## Header

`PageHeader` with the title only. The cards carry the content.

## Grid

```text
lg (main 56rem or wider, 12 columns)         375 px
+---------+---------+---------+---------+    +-----------+
| KPI 3   | KPI 3   | KPI 3   | KPI 3   |    | KPI       |
+---------+---------+---------+---------+    | KPI       |
| Trend 8                     | Break-  |    | KPI       |
|                             | down 4  |    | KPI       |
+-------------+-------------+-+---------+    | Trend     |
| Ranked 4    | Activity 4  | Status 4  |    | Breakdown |
+-------------+-------------+-----------+    | Ranked    |
                                             | Activity  |
                                             | Status    |
                                             +-----------+
```

## Slots

| Slot | Metric kind |
|---|---|
| KPI | 4 counts or rates. |
| Trend | The main activity per day, with the period control. |
| Breakdown | One total split by reason, type, or category. |
| Ranked | The largest open rows by one number, top 5. |
| Activity | The newest rows, with their time and status. |
| Status | The count of rows per status. |

Examples: an agency (projects per week; hours by client; largest open projects; newest tasks; tasks per status).
A stock app (movements per day; stock value by category; largest open orders; newest movements; orders per status).

## Fallback

The data has no ranked list or no recent events: use kpi-band.

## Code

SKILL.md gives the shared rules: states, numbers, charts, RTL, and 375 px.
`KpiRow`, `TrendCard`, and `BreakdownCard` come from the kpi and chart files.
The queries come from data.md. Rename the slot names as its section 5 shows.
Then run `pnpm exec biome check --write` on the changed files, because the new names change the import order.
The page translates the `labelKey` of each KPI and the code of each breakdown part (`downtimeReasons` in data.md).
The main entity is the work orders of tables.md. The code uses its exports with no change:
`workOrdersQueryOptions`, `WorkOrder`, `WORK_ORDER_STATUSES`, `WORK_ORDER_STATUS_BADGE`, the `workOrders` messages,
and the `/app/work-orders` routes. For another entity, rename them as tables.md does.
`reference` is the main text column, `quantity_target` is the ranked number, and `done` is the closed status.

### File: src/routes/app/index.tsx

```tsx
// Route of the home page (/app). The /app layout checks the session first.
// The loader fills the cache of every home query, so the page renders with no spinner.
import { createFileRoute } from "@tanstack/react-router";
import {
	breakdownQueryOptions,
	DEFAULT_DAYS,
	dailySeriesQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
} from "~/features/overview";
import { workOrdersQueryOptions } from "~/features/work-orders";

/** The home page. It waits for every home query, then renders OverviewPage. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(dailySeriesQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(breakdownQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(workOrdersQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
```

### File: src/features/overview/index.ts

```ts
export {
	breakdownQueryOptions,
	dailySeriesQueryOptions,
	overviewKpisQueryOptions,
} from "./api/overview.queries";
export {
	DEFAULT_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
} from "./components/overview-page";
```

### File: src/features/overview/components/overview-page.tsx

```tsx
// The home page (home=bento): KPIs, then the trend beside the breakdown, then three tiles.
// The /app index route renders it after its loader, so every query is in the cache.
// One 12-column grid from 56rem. The grids use @container/main queries.
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { workOrdersQueryOptions } from "~/features/work-orders";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	breakdownQueryOptions,
	dailySeriesQueryOptions,
	overviewKpisQueryOptions,
} from "../api/overview.queries";
import { ActivityCard, ActivityCardSkeleton } from "./activity-card";
import { BreakdownCard, BreakdownCardSkeleton } from "./breakdown-card";
import { KpiRow, KpiRowSkeleton } from "./kpi-row";
import { RankedListCard, RankedListCardSkeleton } from "./ranked-list-card";
import {
	StatusCountsCard,
	StatusCountsCardSkeleton,
} from "./status-counts-card";
import { TrendCard, TrendCardSkeleton } from "./trend-card";

/** Period of the trend and the breakdown on the first visit, in days. The route loader prefetches it. */
export const DEFAULT_DAYS = 30;

// This home shows the first 4 rows of the KPI query. The skeleton shows the same count.
const KPI_COUNT = 4;

const KPI_GRID = "grid-cols-1 @xl/main:grid-cols-2 @5xl/main:grid-cols-4";

const BENTO_GRID =
	"grid @4xl/main:grid-cols-12 grid-cols-1 @3xl/main:gap-6 gap-4";

/** The home of /app. Each card reads the cache that the route loader filled. */
export function OverviewPage() {
	const { t } = useT();
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const { data: breakdown } = useSuspenseQuery(
		breakdownQueryOptions(DEFAULT_DAYS),
	);
	const { data: workOrders } = useSuspenseQuery(workOrdersQueryOptions());
	const [days, setDays] = useState(DEFAULT_DAYS);
	// A click changes the period, so the trend reads with useQuery. The old points stay until the new ones load.
	const trend = useQuery({
		...dailySeriesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	// LIMIT: the tiles count and rank the newest 1,000 rows of the list query. Upgrade: a count read function (data.md, section 3).
	const openWorkOrders = workOrders.filter((row) => row.status !== "done");

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader title={t("overview.title")} />
			{/* No row yet means a first visit: the setup card takes the place of the KPIs. */}
			{workOrders.length === 0 ? (
				<SetupCard />
			) : (
				<KpiRow
					items={kpis.slice(0, KPI_COUNT).map(({ labelKey, ...kpi }) => ({
						...kpi,
						label: t(labelKey),
					}))}
					className={KPI_GRID}
				/>
			)}
			<div className={BENTO_GRID}>
				<div className="@4xl/main:col-span-8 grid grid-cols-1">
					{trend.data ? (
						<TrendCard
							title={t("overview.trendTitle")}
							points={trend.data}
							days={days}
							onDaysChange={setDays}
						/>
					) : trend.isError ? (
						<Card className="min-h-80 items-center justify-center px-6 text-center">
							<p className="text-muted-foreground text-sm" role="alert">
								{t("overview.trendError")}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => trend.refetch()}
							>
								{t("common.retry")}
							</Button>
						</Card>
					) : (
						<TrendCardSkeleton />
					)}
				</div>
				<div className="@4xl/main:col-span-4 grid grid-cols-1">
					<BreakdownCard
						title={t("overview.breakdownTitle")}
						slices={breakdown.map((slice) => ({
							label: t(`downtimeReasons.${slice.label}`),
							value: slice.value,
						}))}
					/>
				</div>
				<div className="@4xl/main:col-span-4 grid grid-cols-1">
					<RankedListCard workOrders={openWorkOrders} />
				</div>
				<div className="@4xl/main:col-span-4 grid grid-cols-1">
					<ActivityCard workOrders={workOrders} />
				</div>
				<div className="@4xl/main:col-span-4 grid grid-cols-1">
					<StatusCountsCard workOrders={workOrders} />
				</div>
			</div>
		</div>
	);
}

// The first visit: no row exists yet. Give one button per real first action, 2 to 4.
function SetupCard() {
	const { t } = useT();
	return (
		<Card className="gap-4 px-6">
			<div className="grid gap-1">
				<h2 className="font-medium font-sans text-sm">
					{t("overview.setupTitle")}
				</h2>
				<p className="text-muted-foreground text-sm">
					{t("overview.setupText")}
				</p>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button asChild variant="outline">
					<Link to="/app/work-orders">{t("workOrders.addFirst")}</Link>
				</Button>
			</div>
		</Card>
	);
}

/** Placeholder in the final shape while the loader runs. The route sets it as pendingComponent. */
export function OverviewPageSkeleton() {
	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<Skeleton className="h-8 w-40" />
			<KpiRowSkeleton count={KPI_COUNT} className={KPI_GRID} />
			<div className={BENTO_GRID}>
				<div className="@4xl/main:col-span-8 grid grid-cols-1">
					<TrendCardSkeleton />
				</div>
				<div className="@4xl/main:col-span-4 grid grid-cols-1">
					<BreakdownCardSkeleton />
				</div>
				<div className="@4xl/main:col-span-4 grid grid-cols-1">
					<RankedListCardSkeleton />
				</div>
				<div className="@4xl/main:col-span-4 grid grid-cols-1">
					<ActivityCardSkeleton />
				</div>
				<div className="@4xl/main:col-span-4 grid grid-cols-1">
					<StatusCountsCardSkeleton />
				</div>
			</div>
		</div>
	);
}

/** Error state of /app when a home query fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="flex flex-col items-start gap-4">
			<PageHeader title={t("overview.title")} />
			<p className="text-sm" role="alert">
				{t("overview.loadError")}
			</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
```

### File: src/features/overview/components/ranked-list-card.tsx

```tsx
// The ranked tile of the bento home: the 5 largest open work orders by target quantity, each with a bar.
// OverviewPage passes the open rows of the list query. Each reference links to its detail page.
// The bars are divs with a width in percent, so they grow from the start side in Arabic too.
import { Link } from "@tanstack/react-router";
import type { WorkOrder } from "~/features/work-orders";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

// Five rows fill the tile at the height of its neighbours.
const RANKED_ROWS = 5;

type RankedListCardProps = {
	/** Open rows of the list query. The card sorts them by target quantity, largest first. */
	workOrders: WorkOrder[];
};

/** Each bar shows its target quantity against the largest one. No open row: one sentence keeps the size. */
export function RankedListCard({ workOrders }: RankedListCardProps) {
	const { t, locale } = useT();
	const numberFormat = new Intl.NumberFormat(locale);
	const ranked = [...workOrders]
		.sort((first, second) => second.quantity_target - first.quantity_target)
		.slice(0, RANKED_ROWS);
	const largest = ranked[0]?.quantity_target ?? 0;
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">
					{t("overview.rankedTitle")}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-3">
				{largest === 0 ? (
					<p className="m-auto text-center text-muted-foreground text-sm">
						{t("overview.rankedEmpty")}
					</p>
				) : (
					ranked.map((workOrder) => (
						<div key={workOrder.id} className="flex flex-col gap-1.5">
							<div className="flex items-baseline justify-between gap-3 text-sm">
								<Link
									to="/app/work-orders/$id"
									params={{ id: workOrder.id }}
									dir="auto"
									className="min-w-0 truncate hover:underline"
								>
									{workOrder.reference}
								</Link>
								<span className="font-medium tabular-nums">
									{numberFormat.format(workOrder.quantity_target)}
								</span>
							</div>
							<div className="h-2 rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-chart-1"
									style={{
										width: `${(workOrder.quantity_target / largest) * 100}%`,
									}}
								/>
							</div>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

/** Placeholder of RankedListCard in its final size. OverviewPageSkeleton renders it. */
export function RankedListCardSkeleton() {
	return (
		<Card className="gap-4 px-6">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-56 w-full" />
		</Card>
	);
}
```

### File: src/features/overview/components/activity-card.tsx

```tsx
// The activity tile of the bento home: the newest work orders with their creation time and status.
// OverviewPage passes the list query rows, newest first. Each reference links to its detail page.
// A creation time is a record, so it shows an absolute date (tables.md, section 2).
import { Link } from "@tanstack/react-router";
import {
	WORK_ORDER_STATUS_BADGE,
	type WorkOrder,
} from "~/features/work-orders";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

// Five rows fill the tile at the height of its neighbours.
const ACTIVITY_ROWS = 5;

type ActivityCardProps = {
	/** Rows of the list query, newest first (the list query orders by created_at). */
	workOrders: WorkOrder[];
};

/** The newest rows. No row: one sentence and the add action. */
export function ActivityCard({ workOrders }: ActivityCardProps) {
	const { t, locale } = useT();
	const timeFormat = new Intl.DateTimeFormat(locale, {
		dateStyle: "short",
		timeStyle: "short",
	});
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">
					{t("overview.activityTitle")}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{workOrders.length === 0 ? (
					<div className="m-auto flex flex-col items-center gap-3 text-center">
						<p className="text-muted-foreground text-sm">
							{t("workOrders.empty")}
						</p>
						<Button asChild variant="outline" size="sm">
							<Link to="/app/work-orders">{t("workOrders.addFirst")}</Link>
						</Button>
					</div>
				) : (
					<ul className="grid gap-3">
						{workOrders.slice(0, ACTIVITY_ROWS).map((workOrder) => (
							<li key={workOrder.id} className="flex items-center gap-3">
								<div className="grid min-w-0 flex-1">
									<Link
										to="/app/work-orders/$id"
										params={{ id: workOrder.id }}
										dir="auto"
										className="max-w-full justify-self-start truncate font-medium text-sm hover:underline"
									>
										{workOrder.reference}
									</Link>
									<span className="text-muted-foreground text-xs tabular-nums">
										{timeFormat.format(new Date(workOrder.created_at))}
									</span>
								</div>
								<Badge variant={WORK_ORDER_STATUS_BADGE[workOrder.status]}>
									{t(`workOrders.statuses.${workOrder.status}`)}
								</Badge>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

/** Placeholder of ActivityCard in its final size. OverviewPageSkeleton renders it. */
export function ActivityCardSkeleton() {
	return (
		<Card className="gap-4 px-6">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-56 w-full" />
		</Card>
	);
}
```

### File: src/features/overview/components/status-counts-card.tsx

```tsx
// The status tile of the bento home: the count of work orders per status, in a 2-column grid of cells.
// OverviewPage passes every row of the list query. The card counts them during render.
// It reads the statuses and the status map of the work-orders feature (tables.md).
import {
	WORK_ORDER_STATUS_BADGE,
	WORK_ORDER_STATUSES,
	type WorkOrder,
} from "~/features/work-orders";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

type StatusCountsCardProps = {
	/** Every row of the list query. A status with no row shows 0. */
	workOrders: WorkOrder[];
};

/** One cell per status, in the order of WORK_ORDER_STATUSES. Zero rows show zeros: that is real data. */
export function StatusCountsCard({ workOrders }: StatusCountsCardProps) {
	const { t, locale } = useT();
	const numberFormat = new Intl.NumberFormat(locale);
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">
					{t("overview.statusTitle")}
				</CardTitle>
			</CardHeader>
			<CardContent className="grid flex-1 grid-cols-2 gap-3">
				{WORK_ORDER_STATUSES.map((status) => (
					<div
						key={status}
						className="flex flex-col justify-between gap-2 rounded-lg border p-3"
					>
						<Badge variant={WORK_ORDER_STATUS_BADGE[status]}>
							{t(`workOrders.statuses.${status}`)}
						</Badge>
						<span className="font-display text-2xl tabular-nums">
							{numberFormat.format(
								workOrders.filter((row) => row.status === status).length,
							)}
						</span>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

/** Placeholder of StatusCountsCard in its final size. OverviewPageSkeleton renders it. */
export function StatusCountsCardSkeleton() {
	return (
		<Card className="gap-4 px-6">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-56 w-full" />
		</Card>
	);
}
```

### Messages

Add this group to `messages` in `src/shared/i18n/messages.ts`. Write the titles for your domain.
The page also reads the `workOrders` group of tables.md.

```ts
overview: {
	title: "Overview",
	setupTitle: "Start here",
	setupText: "Add your first work order to fill this page.",
	loadError: "The overview did not load. Check the connection and try again.",
	trendTitle: "Units per day",
	trendError: "This period did not load.",
	breakdownTitle: "Downtime by reason, last 30 days",
	rankedTitle: "Largest open work orders",
	rankedEmpty: "No open work order. New work orders show here.",
	activityTitle: "Newest work orders",
	statusTitle: "Work orders by status",
},
```
