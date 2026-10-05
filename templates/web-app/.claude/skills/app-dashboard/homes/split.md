# Home split

One tall trend on the start half and four KPIs on the end half. Below: a ranked list beside the newest rows.

## Needs

One strong trend and 4 numbers. The trend is the main story of the app.

## Header

`PageHeader`: the title, and the period Select (7, 30, 90 days) in the actions.
The period changes the trend and the ranked list.

## Grid

```text
lg (main 56rem or wider)                     375 px
+-------------------+---------+---------+    +-----------+
| Trend 1/2         | KPI     | KPI     |    | Trend     |
|                   +---------+---------+    | KPI       |
|                   | KPI     | KPI     |    | KPI       |
+------------+------+---------+---------+    | KPI       |
| Ranked 1/3 | Newest rows 2/3          |    | KPI       |
+------------+--------------------------+    | Ranked    |
                                             | Newest    |
                                             +-----------+
```

## Slots

| Slot | Metric kind |
|---|---|
| Trend | The one daily number that the business lives by. |
| KPI | 4 counts or rates around that number. |
| Ranked | The top parts of one total in the period, largest first (the breakdown query). |
| Newest rows | The newest rows of the main entity, with a status. |

Examples: a shop back office (orders per day; revenue, average basket, returns, open orders; sales by category;
newest orders). A delivery firm (deliveries per day; on time, late, failed, active drivers; deliveries by zone;
newest deliveries).

## Fallback

The data has no strong trend, or fewer than 4 numbers: use kpi-band.

## Code

SKILL.md gives the shared rules: states, numbers, charts, RTL, and 375 px.
`KpiRow` and `TrendCard` come from the kpi and chart files. `TrendCard` gets no `onDaysChange` here.
This home has no breakdown slot. Do not write `breakdown-card.tsx` of the chart file.
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
// The home page (home=split): a tall trend beside 2x2 KPIs, then a ranked list beside the newest rows.
// The /app index route renders it after its loader, so every query is in the cache.
// The period Select of the header drives the trend and the ranked list. Grids use @container/main queries.
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	breakdownQueryOptions,
	dailySeriesQueryOptions,
	overviewKpisQueryOptions,
} from "../api/overview.queries";
import { PERIOD_DAYS } from "../lib/series";
import { KpiRow, KpiRowSkeleton } from "./kpi-row";
import { RankedListCard, RankedListCardSkeleton } from "./ranked-list-card";
import { RecentTableCard, RecentTableCardSkeleton } from "./recent-table-card";
import { TrendCard, TrendCardSkeleton } from "./trend-card";

/** Period of the trend and the ranked list on the first visit, in days. The route loader prefetches it. */
export const DEFAULT_DAYS = 30;

// This home shows the first 4 rows of the KPI query. The skeleton shows the same count.
const KPI_COUNT = 4;

// Six rows match the height of the ranked list beside the table.
const RECENT_ROWS = 6;

// 2x2 from 36rem. The two rows share the height of the trend beside them.
const KPI_GRID = "grid-cols-1 @xl/main:grid-cols-2 @xl/main:grid-rows-2";

/** The home of /app. Each card reads the cache that the route loader filled. */
export function OverviewPage() {
	const { t } = useT();
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const { data: workOrders } = useSuspenseQuery(workOrdersQueryOptions());
	const [days, setDays] = useState(DEFAULT_DAYS);
	// A click changes the period, so these cards read with useQuery. The old data stays until the new data loads.
	const trend = useQuery({
		...dailySeriesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const ranked = useQuery({
		...breakdownQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	// The error form of a card whose period did not load. Try again loads that card again.
	function periodError(retry: () => void) {
		return (
			<Card className="min-h-52 items-center justify-center px-6 text-center">
				<p className="text-muted-foreground text-sm" role="alert">
					{t("overview.periodError")}
				</p>
				<Button type="button" variant="outline" size="sm" onClick={retry}>
					{t("common.retry")}
				</Button>
			</Card>
		);
	}

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("overview.title")}
				actions={
					<Select
						value={String(days)}
						onValueChange={(value) => setDays(Number(value))}
					>
						<SelectTrigger aria-label={t("overview.period")} className="w-40">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PERIOD_DAYS.map((period) => (
								<SelectItem key={period} value={String(period)}>
									{t(`overview.days${period}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				}
			/>
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="grid grid-cols-1">
					{trend.data ? (
						<TrendCard
							title={t("overview.trendTitle")}
							points={trend.data}
							days={days}
						/>
					) : trend.isError ? (
						periodError(() => trend.refetch())
					) : (
						<TrendCardSkeleton />
					)}
				</div>
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
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="grid grid-cols-1">
					{ranked.data ? (
						<RankedListCard
							title={t("overview.rankedTitle")}
							slices={ranked.data.map((slice) => ({
								label: t(`downtimeReasons.${slice.label}`),
								value: slice.value,
							}))}
						/>
					) : ranked.isError ? (
						periodError(() => ranked.refetch())
					) : (
						<RankedListCardSkeleton />
					)}
				</div>
				<div className="@4xl/main:col-span-2 grid grid-cols-1">
					<RecentTableCard workOrders={workOrders.slice(0, RECENT_ROWS)} />
				</div>
			</div>
		</div>
	);
}

// The first visit: no row exists yet. Give one button per real first action, 2 to 4.
function SetupCard() {
	const { t } = useT();
	return (
		<Card className="justify-center gap-4 px-6">
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
				<Skeleton className="h-9 w-40" />
			</div>
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
				<TrendCardSkeleton />
				<KpiRowSkeleton count={KPI_COUNT} className={KPI_GRID} />
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<RankedListCardSkeleton />
				<div className="@4xl/main:col-span-2 grid grid-cols-1">
					<RecentTableCardSkeleton />
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
// The ranked list of the split home: the parts of one total, largest first, each with a bar.
// OverviewPage passes the translated breakdown of the chosen period (data.md, breakdownQueryOptions).
// The bars are divs with a width in percent, so they grow from the start side in Arabic too.
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { BreakdownSlice } from "../lib/series";

type RankedListCardProps = {
	/** Card title, already translated. It names the total and the period. */
	title: string;
	/** Parts of the total, with translated labels. The SQL function orders them: largest first, "other" last. */
	slices: BreakdownSlice[];
};

/** Each bar shows its part against the largest part. No part: one sentence keeps the card size. */
export function RankedListCard({ title, slices }: RankedListCardProps) {
	const { t, locale } = useT();
	const numberFormat = new Intl.NumberFormat(locale);
	const largest = Math.max(0, ...slices.map((slice) => slice.value));
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">{title}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-3">
				{largest === 0 ? (
					<p className="m-auto text-center text-muted-foreground text-sm">
						{t("overview.rankedEmpty")}
					</p>
				) : (
					slices.map((slice) => (
						<div key={slice.label} className="flex flex-col gap-1.5">
							<div className="flex items-baseline justify-between gap-3 text-sm">
								<span className="min-w-0 truncate">{slice.label}</span>
								<span className="font-medium tabular-nums">
									{numberFormat.format(slice.value)}
								</span>
							</div>
							<div className="h-2 rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-chart-1"
									style={{ width: `${(slice.value / largest) * 100}%` }}
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
	period: "Period",
	days7: "Last 7 days",
	days30: "Last 30 days",
	days90: "Last 90 days",
	setupTitle: "Start here",
	setupText: "Add your first work order to fill this page.",
	loadError: "The overview did not load. Check the connection and try again.",
	periodError: "This period did not load.",
	trendTitle: "Units per day",
	rankedTitle: "Downtime by reason",
	rankedEmpty: "Nothing in this period yet.",
	recentTitle: "Newest work orders",
	seeAll: "See all",
},
```
