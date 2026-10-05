# Home focus-queue

The work queue is the main block: open rows by status, soonest due date first. A compact KPI strip sits above it.
The trend and one breakdown sit below it.

## Needs

An entity with a status and a due date. The team works through it every day.

## Header

`PageHeader`: the title, and the count of open rows in the description.

## Grid

```text
lg (main 56rem or wider)                     375 px
+---------+---------+---------+---------+    +-----+-----+
| KPI     | KPI     | KPI     | KPI     |    | KPI | KPI |
+---------+---------+---------+---------+    | KPI | KPI |
| Queue  [All 9][Planned 4][Blocked 2]  |    +-----+-----+
| row  ............ due ...... status   |    | Queue     |
| row  ............ due ...... status   |    | (tabs     |
| (at most 10 rows)          See all -> |    |  scroll)  |
+-------------------+-------------------+    | Trend     |
| Trend 1/2         | Breakdown 1/2     |    | Breakdown |
+-------------------+-------------------+    +-----------+
```

## Slots

| Slot | Metric kind |
|---|---|
| KPI | 4 small counts of the queue or of today. The strip has 2 columns at 375 px. |
| Queue | The open rows of the main entity. One tab per status that has rows, with its count. |
| Trend | The work done per day (rows closed or units made), with the period control. |
| Breakdown | The open rows or the period total, split by type, owner, or reason. |

Examples: a support desk (open tickets by status; tickets closed per day; tickets by channel).
A workshop (open work orders by status; orders done per day; downtime by reason).

## Fallback

No status or no due date in the data: use kpi-band.

## Code

SKILL.md gives the shared rules: states, numbers, charts, RTL, and 375 px.
`KpiRow`, `TrendCard`, and `BreakdownCard` come from the kpi and chart files.
The queries come from data.md. Rename the slot names as its section 5 shows.
Then run `pnpm exec biome check --write` on the changed files, because the new names change the import order.
The page translates the `labelKey` of each KPI and the code of each breakdown part (`downtimeReasons` in data.md).
The main entity is the work orders of tables.md. The code uses its exports with no change:
`workOrdersQueryOptions`, `WorkOrder`, `WORK_ORDER_STATUSES`, `WORK_ORDER_STATUS_BADGE`, the `workOrders` messages,
the `/app/work-orders` routes, and `formatRelativeTime`. For another entity, rename them as tables.md does.
`reference` is the main text column, and `done` is the closed status.
A due date that can be null: sort those rows last, and never count them as late.

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
// The home page (home=focus-queue): a compact KPI strip, the work queue, then trend and breakdown.
// The /app index route renders it after its loader, so every query is in the cache.
// The grids use @container/main queries: the AppShell main element is the container.
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
import { BreakdownCard, BreakdownCardSkeleton } from "./breakdown-card";
import { KpiRow, KpiRowSkeleton } from "./kpi-row";
import { QueueCard, QueueCardSkeleton } from "./queue-card";
import { TrendCard, TrendCardSkeleton } from "./trend-card";

/** Period of the trend and the breakdown on the first visit, in days. The route loader prefetches it. */
export const DEFAULT_DAYS = 30;

// This home shows the first 4 rows of the KPI query. The skeleton shows the same count.
const KPI_COUNT = 4;

// A compact strip: 2 columns on a phone, 4 from 48rem.
const KPI_GRID = "grid-cols-2 @3xl/main:grid-cols-4";

/** The home of /app. Each card reads the cache that the route loader filled. */
export function OverviewPage() {
	const { t, locale } = useT();
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
	// LIMIT: the count and the queue read the newest 1,000 rows of the list query. Upgrade: an open-rows query ordered by due date.
	const openWorkOrders = workOrders.filter((row) => row.status !== "done");

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("overview.title")}
				description={
					<>
						{t("overview.openCount")}{" "}
						<span className="font-medium text-foreground tabular-nums">
							{new Intl.NumberFormat(locale).format(openWorkOrders.length)}
						</span>
					</>
				}
			/>
			{/* No row yet means a first visit: the setup card takes the place of the KPI strip. */}
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
			<QueueCard workOrders={openWorkOrders} />
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="grid grid-cols-1">
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
				<BreakdownCard
					title={t("overview.breakdownTitle")}
					slices={breakdown.map((slice) => ({
						label: t(`downtimeReasons.${slice.label}`),
						value: slice.value,
					}))}
				/>
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
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-28" />
			</div>
			<KpiRowSkeleton count={KPI_COUNT} className={KPI_GRID} />
			<QueueCardSkeleton />
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
				<TrendCardSkeleton />
				<BreakdownCardSkeleton />
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

### File: src/features/overview/components/queue-card.tsx

```tsx
// The work queue of the focus-queue home: open work orders in status tabs, soonest due time first.
// OverviewPage passes the open rows of the list query. Each reference links to its detail page.
// The tabs are local UI state (Radix, uncontrolled). The full list page holds the filters.
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import {
	WORK_ORDER_STATUS_BADGE,
	WORK_ORDER_STATUSES,
	type WorkOrder,
} from "~/features/work-orders";
import { useT } from "~/shared/i18n";
import { formatRelativeTime } from "~/shared/lib/relative-time";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";

// Ten rows keep the queue short enough to scan. See all opens the full list.
const QUEUE_ROWS = 10;

type QueueCardProps = {
	/** The open rows of the list query (every status except the closed one). */
	workOrders: WorkOrder[];
};

/** Tab "all" first, then one tab per status that has rows. No open row: one sentence and the add action. */
export function QueueCard({ workOrders }: QueueCardProps) {
	const { t, locale } = useT();
	const countFormat = new Intl.NumberFormat(locale);
	const now = Date.now();
	const sorted = [...workOrders].sort(
		(first, second) => Date.parse(first.due_at) - Date.parse(second.due_at),
	);
	const tabs = [
		{ value: "all", label: t("overview.queueAll"), rows: sorted },
		...WORK_ORDER_STATUSES.map((status) => ({
			value: status,
			label: t(`workOrders.statuses.${status}`),
			rows: sorted.filter((row) => row.status === status),
		})).filter((tab) => tab.rows.length > 0),
	];

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">
					{t("overview.queueTitle")}
				</CardTitle>
				<CardAction>
					<Button asChild variant="ghost" size="sm">
						<Link to="/app/work-orders">
							{t("overview.seeAll")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{workOrders.length === 0 ? (
					<div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
						<p className="text-muted-foreground text-sm">
							{t("overview.queueEmpty")}
						</p>
						<Button asChild variant="outline" size="sm">
							<Link to="/app/work-orders">{t("workOrders.add")}</Link>
						</Button>
					</div>
				) : (
					<Tabs defaultValue="all">
						<TabsList className="max-w-full justify-start overflow-x-auto">
							{tabs.map((tab) => (
								<TabsTrigger key={tab.value} value={tab.value}>
									{tab.label}
									<span className="text-muted-foreground tabular-nums">
										{countFormat.format(tab.rows.length)}
									</span>
								</TabsTrigger>
							))}
						</TabsList>
						{tabs.map((tab) => (
							<TabsContent key={tab.value} value={tab.value}>
								<ul className="divide-y">
									{tab.rows.slice(0, QUEUE_ROWS).map((workOrder) => {
										const isLate = Date.parse(workOrder.due_at) < now;
										return (
											<li
												key={workOrder.id}
												className="flex items-center gap-3 py-2.5"
											>
												<div className="grid min-w-0 flex-1">
													<Link
														to="/app/work-orders/$id"
														params={{ id: workOrder.id }}
														dir="auto"
														className="max-w-full justify-self-start truncate font-medium text-sm hover:underline"
													>
														{workOrder.reference}
													</Link>
													<span
														className={cn(
															"text-xs tabular-nums",
															isLate
																? "text-destructive"
																: "text-muted-foreground",
														)}
													>
														{isLate ? `${t("overview.late")} · ` : null}
														{formatRelativeTime(workOrder.due_at, now, locale)}
													</span>
												</div>
												<Badge
													variant={WORK_ORDER_STATUS_BADGE[workOrder.status]}
												>
													{t(`workOrders.statuses.${workOrder.status}`)}
												</Badge>
											</li>
										);
									})}
								</ul>
							</TabsContent>
						))}
					</Tabs>
				)}
			</CardContent>
		</Card>
	);
}

/** Placeholder of QueueCard in its final size. OverviewPageSkeleton renders it. */
export function QueueCardSkeleton() {
	return (
		<Card className="gap-4 px-6">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-9 w-72 max-w-full" />
			<Skeleton className="h-80 w-full" />
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
	openCount: "Open work orders:",
	setupTitle: "Start here",
	setupText: "Add your first work order to fill this page.",
	loadError: "The overview did not load. Check the connection and try again.",
	trendTitle: "Units per day",
	trendError: "This period did not load.",
	breakdownTitle: "Downtime by reason, last 30 days",
	queueTitle: "Work queue",
	queueAll: "All",
	queueEmpty: "Nothing is open. New work orders show here.",
	late: "Late",
	seeAll: "See all",
},
```
