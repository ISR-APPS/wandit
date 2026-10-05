# Home kpi-band

A band of KPIs, the main trend beside one breakdown, then the newest rows.

## Needs

3 or 4 numbers and one trend. It fits every app, so the other homes use it as their fallback.

## Header

`PageHeader`: the title, a scope line, and the main action.
The scope line names what the page shows. Each card names its own period.

## Grid

```text
lg (main 56rem or wider)                     375 px
+---------+---------+---------+---------+    +-----------+
| KPI     | KPI     | KPI     | KPI     |    | KPI       |
+---------+---------+---------+---------+    | KPI       |
| Trend 2/3                   | Break-  |    | KPI       |
|                             | down 1/3|    | KPI       |
+-----------------------------+---------+    | Trend     |
| Newest rows (full width)              |    | Breakdown |
+---------------------------------------+    | Newest    |
                                             +-----------+
```

## Slots

| Slot | Metric kind |
|---|---|
| KPI | The 3 or 4 counts or rates that the team checks first. |
| Trend | The main activity per day, with the period control. |
| Breakdown | One total split by reason, type, or category. |
| Newest rows | The newest rows of the main entity, with a status. |

Examples: a factory (units today, machines running, late orders, scrap rate; units per day; downtime by reason;
newest work orders). A clinic (visits today, no-shows, open slots, revenue; visits per day; visits by type;
next appointments).

## Fallback

None. With only 3 good numbers, set `KPI_COUNT` to 3 and `@5xl/main:grid-cols-3` in `KPI_GRID`.
Never fill a slot with a weak number.

## Code

SKILL.md gives the shared rules: states, numbers, charts, RTL, and 375 px.
`KpiRow`, `TrendCard`, and `BreakdownCard` come from the kpi and chart files.
The queries come from data.md. Rename the slot names as its section 5 shows.
Then run `pnpm exec biome check --write` on the changed files, because the new names change the import order.
The page translates the `labelKey` of each KPI and the code of each breakdown part (`downtimeReasons` in data.md).
The main entity is the work orders of tables.md. The code uses its exports with no change:
`workOrdersQueryOptions`, `WorkOrder`, `WORK_ORDER_STATUS_BADGE`, the `workOrders` messages, the `/app/work-orders` routes,
and `formatRelativeTime`. For another entity, rename them as tables.md does.
`reference` is the main text column, and `product` is its second line.

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
// The home page (home=kpi-band): the KPI band, the trend beside the breakdown, and the newest rows.
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
import { RecentTableCard, RecentTableCardSkeleton } from "./recent-table-card";
import { TrendCard, TrendCardSkeleton } from "./trend-card";

/** Period of the trend and the breakdown on the first visit, in days. The route loader prefetches it. */
export const DEFAULT_DAYS = 30;

// This home shows the first 4 rows of the KPI query. The skeleton shows the same count.
const KPI_COUNT = 4;

// Six rows keep the page short at 1440 px. The card links to the full list.
const RECENT_ROWS = 6;

const KPI_GRID = "grid-cols-1 @xl/main:grid-cols-2 @5xl/main:grid-cols-4";

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

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("overview.title")}
				description={t("overview.scope")}
				actions={
					<Button asChild>
						<Link to="/app/work-orders">{t("workOrders.add")}</Link>
					</Button>
				}
			/>
			{/* No row yet means a first visit: the setup card takes the place of the KPI band. */}
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
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2 grid grid-cols-1">
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
			<RecentTableCard workOrders={workOrders.slice(0, RECENT_ROWS)} />
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
				<Skeleton className="h-4 w-56" />
			</div>
			<KpiRowSkeleton count={KPI_COUNT} className={KPI_GRID} />
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2 grid grid-cols-1">
					<TrendCardSkeleton />
				</div>
				<BreakdownCardSkeleton />
			</div>
			<RecentTableCardSkeleton />
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

### File: src/features/overview/components/recent-table-card.tsx

```tsx
// The newest work orders on the home page, in a table inside a card.
// OverviewPage passes the first rows of the list query. Each reference links to its detail page.
// The columns follow tables.md: a name cell with two lines, and a relative due time.
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
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
	scope: "Production, downtime, and the newest work orders.",
	setupTitle: "Start here",
	setupText: "Add your first work order to fill this page.",
	loadError: "The overview did not load. Check the connection and try again.",
	trendTitle: "Units per day",
	trendError: "This period did not load.",
	breakdownTitle: "Downtime by reason, last 30 days",
	recentTitle: "Newest work orders",
	seeAll: "See all",
},
```
