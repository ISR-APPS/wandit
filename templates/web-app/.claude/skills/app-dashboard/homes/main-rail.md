# Home main-rail

A wide main column (KPIs, trend, newest rows) and a narrow rail at the end side.
The rail lists the rows that need a person now. It stays in view when the page scrolls.

## Needs

An attention list: rows that are late, blocked, or under a threshold. The rail is the reason for this home.

## Header

`PageHeader`: the title and the main action.

## Grid

```text
lg (main 64rem or wider)                     375 px
+-------+-------+-------+  +----------+      +-----------+
| KPI   | KPI   | KPI   |  | Needs    |      | KPI       |
+-------+-------+-------+  | attention|      | KPI       |
| Trend                 |  +----------+      | KPI       |
|                       |  | Due next |      | Trend     |
+-----------------------+  +----------+      | Newest    |
| Newest rows           |   rail 20rem,      | Attention |
+-----------------------+   sticky           | Due next  |
                                             +-----------+
```

## Slots

| Slot | Metric kind |
|---|---|
| KPI | 3 counts or rates. |
| Trend | The main activity per day, with the period control. |
| Newest rows | The newest rows of the main entity, with a status. |
| Needs attention | Open rows that are late or blocked, oldest due date first. |
| Due next | Open rows with a due date to come, soonest first. |

Examples: a repair shop (jobs today, waiting for parts, ready; jobs per day; newest jobs; late or blocked jobs;
next pickups). A stock app (movements today, items under minimum, open orders; movements per day; newest orders;
items under minimum; next deliveries).

A quick actions card in the rail: add it only when 2 or more real create forms exist. Each button opens one form.

## Fallback

No attention list in the data: use kpi-band.

## Code

SKILL.md gives the shared rules: states, numbers, charts, RTL, and 375 px.
`KpiRow` and `TrendCard` come from the kpi and chart files.
This home has no breakdown slot. Do not write `breakdown-card.tsx` of the chart file.
The queries come from data.md. Rename the slot names as its section 5 shows.
Then run `pnpm exec biome check --write` on the changed files, because the new names change the import order.
The page translates the `labelKey` of each KPI.
The main entity is the work orders of tables.md. The code uses its exports with no change:
`workOrdersQueryOptions`, `WorkOrder`, `WORK_ORDER_STATUS_BADGE`, the `workOrders` messages, the `/app/work-orders` routes,
and `formatRelativeTime`. For another entity, rename them as tables.md does.
`reference` is the main text column, and `product` is its second line.
`done` is the closed status and `blocked` is the stuck status.
A due date that can be null: sort those rows last, and never count them as late.

### File: src/routes/app/index.tsx

```tsx
// Route of the home page (/app). The /app layout checks the session first.
// The loader fills the cache of every home query, so the page renders with no spinner.
import { createFileRoute } from "@tanstack/react-router";
import {
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
// The home page (home=main-rail): KPIs, trend, and newest rows, beside a sticky rail of open work.
// The /app index route renders it after its loader, so every query is in the cache.
// The rail sits at the end side from 64rem and under the main column below. Grids use @container/main queries.
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { type WorkOrder, workOrdersQueryOptions } from "~/features/work-orders";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	dailySeriesQueryOptions,
	overviewKpisQueryOptions,
} from "../api/overview.queries";
import { KpiRow, KpiRowSkeleton } from "./kpi-row";
import { RailListCard, RailListCardSkeleton } from "./rail-list-card";
import { RecentTableCard, RecentTableCardSkeleton } from "./recent-table-card";
import { TrendCard, TrendCardSkeleton } from "./trend-card";

/** Period of the trend on the first visit, in days. The route loader prefetches it. */
export const DEFAULT_DAYS = 30;

// This home shows the first 3 rows of the KPI query. The skeleton shows the same count.
const KPI_COUNT = 3;

// Six rows keep the page short at 1440 px. The card links to the full list.
const RECENT_ROWS = 6;

const KPI_GRID = "grid-cols-1 @xl/main:grid-cols-3";

// The rail is 20rem wide from 64rem. Below, it moves under the main column.
const PAGE_GRID =
	"grid grid-cols-1 items-start gap-4 @3xl/main:gap-6 @5xl/main:grid-cols-[minmax(0,1fr)_20rem]";

// Sorts the rail rows: the oldest due time first.
function byDueTime(first: WorkOrder, second: WorkOrder): number {
	return Date.parse(first.due_at) - Date.parse(second.due_at);
}

/** The home of /app. Each card reads the cache that the route loader filled. */
export function OverviewPage() {
	const { t } = useT();
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const { data: workOrders } = useSuspenseQuery(workOrdersQueryOptions());
	const [days, setDays] = useState(DEFAULT_DAYS);
	// A click changes the period, so the trend reads with useQuery. The old points stay until the new ones load.
	const trend = useQuery({
		...dailySeriesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const now = Date.now();
	// LIMIT: the rail reads the newest 1,000 rows of the list query. Upgrade: an open-rows query ordered by due date.
	const openWorkOrders = workOrders
		.filter((row) => row.status !== "done")
		.sort(byDueTime);
	// Late or blocked: the two reasons that need a person now.
	const attentionWorkOrders = openWorkOrders.filter(
		(row) => row.status === "blocked" || Date.parse(row.due_at) < now,
	);
	const dueNextWorkOrders = openWorkOrders.filter(
		(row) => row.status !== "blocked" && Date.parse(row.due_at) >= now,
	);

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("overview.title")}
				actions={
					<Button asChild>
						<Link to="/app/work-orders">{t("workOrders.add")}</Link>
					</Button>
				}
			/>
			<div className={PAGE_GRID}>
				<div className="flex min-w-0 flex-col @3xl/main:gap-6 gap-4">
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
					<RecentTableCard workOrders={workOrders.slice(0, RECENT_ROWS)} />
				</div>
				{/* The rail stays in view under the 3rem sticky header while the main column scrolls. */}
				<div className="@5xl/main:sticky @5xl/main:top-16 flex flex-col @3xl/main:gap-6 gap-4">
					<RailListCard
						title={t("overview.attentionTitle")}
						emptyText={t("overview.attentionEmpty")}
						workOrders={attentionWorkOrders}
						now={now}
					/>
					<RailListCard
						title={t("overview.dueNextTitle")}
						emptyText={t("overview.dueNextEmpty")}
						workOrders={dueNextWorkOrders}
						now={now}
					/>
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
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<div className={PAGE_GRID}>
				<div className="flex min-w-0 flex-col @3xl/main:gap-6 gap-4">
					<KpiRowSkeleton count={KPI_COUNT} className={KPI_GRID} />
					<TrendCardSkeleton />
					<RecentTableCardSkeleton />
				</div>
				<div className="flex flex-col @3xl/main:gap-6 gap-4">
					<RailListCardSkeleton />
					<RailListCardSkeleton />
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

### File: src/features/overview/components/rail-list-card.tsx

```tsx
// A short list of open work orders in the home rail: the reference, the due time, and the status.
// OverviewPage renders it twice: the rows that need attention, and the rows due next.
// A row past its due time shows the time in the destructive color, with the word "late".
import { Link } from "@tanstack/react-router";
import {
	WORK_ORDER_STATUS_BADGE,
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

// Five rows keep both rail cards in view at 900 px of height.
const LIST_ROWS = 5;

type RailListCardProps = {
	/** Card title, already translated. */
	title: string;
	/** The muted sentence when no row matches. An empty list is the normal state, so it has no action. */
	emptyText: string;
	/** The rows to list, already filtered and sorted by OverviewPage. */
	workOrders: WorkOrder[];
	/** The render time in ms (Date.now() of OverviewPage), so both cards agree on "late". */
	now: number;
};

/** The count beside the title, the first rows, and a See all link when rows are hidden. */
export function RailListCard({
	title,
	emptyText,
	workOrders,
	now,
}: RailListCardProps) {
	const { t, locale } = useT();
	const countFormat = new Intl.NumberFormat(locale);
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="flex items-baseline gap-2 font-medium text-sm">
					{title}
					<span className="text-muted-foreground tabular-nums">
						{countFormat.format(workOrders.length)}
					</span>
				</CardTitle>
				{/* The list page has no filter in its URL, so the link opens all rows and shows no count. */}
				{workOrders.length > LIST_ROWS ? (
					<CardAction>
						<Button asChild variant="ghost" size="sm">
							<Link to="/app/work-orders">{t("overview.seeAll")}</Link>
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent>
				{workOrders.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{emptyText}
					</p>
				) : (
					<ul className="grid gap-3">
						{workOrders.slice(0, LIST_ROWS).map((workOrder) => {
							const isLate = Date.parse(workOrder.due_at) < now;
							return (
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
										<span
											className={cn(
												"text-xs tabular-nums",
												isLate ? "text-destructive" : "text-muted-foreground",
											)}
										>
											{isLate ? `${t("overview.late")} · ` : null}
											{formatRelativeTime(workOrder.due_at, now, locale)}
										</span>
									</div>
									<Badge variant={WORK_ORDER_STATUS_BADGE[workOrder.status]}>
										{t(`workOrders.statuses.${workOrder.status}`)}
									</Badge>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

/** Placeholder of RailListCard in its final size. OverviewPageSkeleton renders it. */
export function RailListCardSkeleton() {
	return (
		<Card className="gap-4 px-6">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-48 w-full" />
		</Card>
	);
}
```

### File: src/features/overview/components/recent-table-card.tsx

```tsx
// The newest work orders on the home page, in a table inside a card.
// OverviewPage passes the first rows of the list query. Each reference links to its detail page.
// The columns follow tables.md: a name cell with two lines, and a relative due time.
import { Link } from "@tanstack/react-router";
import {
	WORK_ORDER_STATUS_BADGE,
	type WorkOrder,
} from "~/features/work-orders";
import { useT } from "~/shared/i18n";
import { formatRelativeTime } from "~/shared/lib/relative-time";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { ArrowRightIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

type RecentTableCardProps = {
	/** The newest rows of the list query, already cut to the count that fits. */
	workOrders: WorkOrder[];
};

/** The newest rows with their status and due time. No row: one sentence and the add action. */
export function RecentTableCard({ workOrders }: RecentTableCardProps) {
	const { t, locale } = useT();
	const now = Date.now();
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">
					{t("overview.recentTitle")}
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
							{t("workOrders.empty")}
						</p>
						<Button asChild variant="outline" size="sm">
							<Link to="/app/work-orders">{t("workOrders.addFirst")}</Link>
						</Button>
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("workOrders.reference")}</TableHead>
								<TableHead>{t("workOrders.status")}</TableHead>
								<TableHead className="text-end">
									{t("workOrders.due")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{workOrders.map((workOrder) => (
								<TableRow key={workOrder.id}>
									<TableCell>
										{/* justify-items-start: each line is as wide as its text, so it starts at the start side in Arabic. */}
										<div className="grid @xl/main:max-w-64 max-w-40 justify-items-start">
											<Link
												to="/app/work-orders/$id"
												params={{ id: workOrder.id }}
												dir="auto"
												className="max-w-full truncate font-medium hover:underline"
											>
												{workOrder.reference}
											</Link>
											<span
												dir="auto"
												className="max-w-full truncate text-muted-foreground text-xs"
											>
												{workOrder.product}
											</span>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant={WORK_ORDER_STATUS_BADGE[workOrder.status]}>
											{t(`workOrders.statuses.${workOrder.status}`)}
										</Badge>
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{formatRelativeTime(workOrder.due_at, now, locale)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}

/** Placeholder of RecentTableCard in its final size. OverviewPageSkeleton renders it. */
export function RecentTableCardSkeleton() {
	return (
		<Card className="gap-4 px-6">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-72 w-full" />
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
	attentionTitle: "Needs attention",
	attentionEmpty: "Nothing is late or blocked.",
	dueNextTitle: "Due next",
	dueNextEmpty: "No open work order is due later.",
	late: "Late",
	recentTitle: "Newest work orders",
	seeAll: "See all",
},
```
