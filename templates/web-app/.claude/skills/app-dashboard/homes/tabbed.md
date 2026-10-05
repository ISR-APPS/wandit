# Home tabbed

The page header holds page tabs. The first tab is the overview. Each other tab belongs to one main entity.
The URL keeps the open tab (`?tab=`), so a reload or a shared link opens the same tab.

## Needs

2 or more main entities, each with its own trend. One page would be too long for all of them.

## Header

`PageHeader`: the title, and the page `TabsList` in the actions. The tab lives in the search params
of `/app` through `validateSearch`: a zod enum with a default and a catch.

## Grid

```text
lg (main 56rem or wider)                     375 px
Overview   [Overview][Work orders]           Overview
+---------+---------+---------+---------+    [Overview][Work orders]
| KPI     | KPI     | KPI     | KPI     |    +-----------+
+---------+---------+---------+---------+    | KPI x4    |
| Trend 2/3                   | Side 1/3|    | Trend     |
+-----------------------------+---------+    | Side card |
                                             +-----------+
Tab "work-orders":                           Tab "work-orders":
+-------------------+-------------------+    +-----------+
| Entity trend 1/2  | Newest rows 1/2   |    | Trend     |
+-------------------+-------------------+    | Newest    |
                                             +-----------+
```

## Slots

| Slot | Metric kind |
|---|---|
| KPI | The 4 numbers of the whole business. |
| Trend | The main activity per day, with the period control. |
| Side card | One total split by reason, type, or category. |
| Entity trend | The events of one entity per day. The period is the same as the main trend. |
| Entity table | The newest rows of that entity. |

A second entity tab: add its id to `overviewTabSchema` and to `TAB_LABELS`, its daily query to the loader,
and one `TabsContent`. Each entity needs its own daily read function (data.md, section 3).
Its query options go in `overview.queries.ts`, beside the other home queries.

Examples: a school (overview; students: enrollments per day, newest students; payments: payments per day,
newest payments). A rental agency (overview; leases: leases signed per day; maintenance: requests per day).

## Fallback

One main entity only: use kpi-band.

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
`workOrdersDailyQueryOptions(days)` reads the new work orders per day, in the shape of `dailySeriesQueryOptions(days)`.
data.md has no such function. Write it in `overview.queries.ts` like `dailyProductionQueryOptions` (data.md, section 8).

### File: src/features/overview/lib/overview-tab.ts

```ts
// The tabs of the tabbed home and the search schema of the /app route.
// The /app index route validates ?tab= with it. OverviewPage renders one panel per tab id.
import { z } from "zod";

/** Tab ids of the home, in display order. Add one id per entity tab, and its label in TAB_LABELS. */
export const overviewTabSchema = z.enum(["overview", "work-orders"]);

/** One tab id of the home. */
export type OverviewTab = z.infer<typeof overviewTabSchema>;

/** Search params of /app. A missing or unknown tab gives "overview", so an old link still opens the page. */
export const overviewSearchSchema = z.object({
	tab: overviewTabSchema.default("overview").catch("overview"),
});
```

### File: src/routes/app/index.tsx

```tsx
// Route of the home page (/app). The /app layout checks the session first.
// validateSearch reads ?tab=. The loader fills the cache of every tab, so a tab switch has no spinner.
// The route gives the page the tab of the URL and the tab change.
import { createFileRoute } from "@tanstack/react-router";
import {
	breakdownQueryOptions,
	DEFAULT_DAYS,
	dailySeriesQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
	overviewSearchSchema,
	workOrdersDailyQueryOptions,
} from "~/features/overview";
import { workOrdersQueryOptions } from "~/features/work-orders";

/** The home page with its tab in the URL. It waits for every home query, then renders OverviewPage. */
export const Route = createFileRoute("/app/")({
	validateSearch: overviewSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(dailySeriesQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(breakdownQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(workOrdersQueryOptions()),
			context.queryClient.query(workOrdersDailyQueryOptions(DEFAULT_DAYS)),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewRoute,
});

function OverviewRoute() {
	const { tab } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<OverviewPage
			tab={tab}
			onTabChange={(next) => navigate({ search: { tab: next } })}
		/>
	);
}
```

### File: src/features/overview/index.ts

```ts
export {
	breakdownQueryOptions,
	dailySeriesQueryOptions,
	overviewKpisQueryOptions,
	workOrdersDailyQueryOptions,
} from "./api/overview.queries";
export {
	DEFAULT_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
} from "./components/overview-page";
export { overviewSearchSchema } from "./lib/overview-tab";
```

### File: src/features/overview/components/overview-page.tsx

```tsx
// The home page (home=tabbed): page tabs in the header, the overview tab, and one tab per entity.
// The /app index route renders it after its loader and gives it the tab of the URL.
// Radix renders only the open panel. The grids use @container/main queries.
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { workOrdersQueryOptions } from "~/features/work-orders";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	breakdownQueryOptions,
	dailySeriesQueryOptions,
	overviewKpisQueryOptions,
	workOrdersDailyQueryOptions,
} from "../api/overview.queries";
import { type OverviewTab, overviewTabSchema } from "../lib/overview-tab";
import { BreakdownCard, BreakdownCardSkeleton } from "./breakdown-card";
import { KpiRow, KpiRowSkeleton } from "./kpi-row";
import { RecentTableCard } from "./recent-table-card";
import { TrendCard, TrendCardSkeleton } from "./trend-card";

/** Period of the trends and the breakdown on the first visit, in days. The route loader prefetches it. */
export const DEFAULT_DAYS = 30;

// This home shows the first 4 rows of the KPI query. The skeleton shows the same count.
const KPI_COUNT = 4;

// Eight rows fill the entity tab beside its trend. The card links to the full list.
const RECENT_ROWS = 8;

const KPI_GRID = "grid-cols-1 @xl/main:grid-cols-2 @5xl/main:grid-cols-4";

// The label of each tab. An entity tab reuses the title of its list page.
const TAB_LABELS = {
	overview: "overview.tabOverview",
	"work-orders": "workOrders.title",
} satisfies Record<OverviewTab, TranslationKey>;

type OverviewPageProps = {
	/** The open tab, from ?tab= of the URL (validated by overviewSearchSchema). */
	tab: OverviewTab;
	/** Writes a new tab into the URL. The route passes a navigate call. */
	onTabChange: (tab: OverviewTab) => void;
};

/** The home of /app. Each card reads the cache that the route loader filled. */
export function OverviewPage({ tab, onTabChange }: OverviewPageProps) {
	const { t } = useT();
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const { data: breakdown } = useSuspenseQuery(
		breakdownQueryOptions(DEFAULT_DAYS),
	);
	const { data: workOrders } = useSuspenseQuery(workOrdersQueryOptions());
	// One period for both trends. A click changes it, so the trends read with useQuery.
	const [days, setDays] = useState(DEFAULT_DAYS);
	const trend = useQuery({
		...dailySeriesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const workOrdersTrend = useQuery({
		...workOrdersDailyQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	// A trend card, its error form with Try again, or its skeleton while the new period loads.
	function trendSlot(query: typeof trend, title: string) {
		if (query.data) {
			return (
				<TrendCard
					title={title}
					points={query.data}
					days={days}
					onDaysChange={setDays}
				/>
			);
		}
		if (query.isError) {
			return (
				<Card className="min-h-80 items-center justify-center px-6 text-center">
					<p className="text-muted-foreground text-sm" role="alert">
						{t("overview.trendError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => query.refetch()}
					>
						{t("common.retry")}
					</Button>
				</Card>
			);
		}
		return <TrendCardSkeleton />;
	}

	return (
		<Tabs
			value={tab}
			onValueChange={(value) => {
				// Radix gives a plain string. Only the ids of overviewTabSchema reach the URL.
				const next = overviewTabSchema.safeParse(value);
				if (next.success) {
					onTabChange(next.data);
				}
			}}
			className="@3xl/main:gap-6 gap-4"
		>
			<PageHeader
				title={t("overview.title")}
				actions={
					<TabsList>
						{overviewTabSchema.options.map((id) => (
							<TabsTrigger key={id} value={id}>
								{t(TAB_LABELS[id])}
							</TabsTrigger>
						))}
					</TabsList>
				}
			/>
			<TabsContent
				value="overview"
				className="flex flex-col @3xl/main:gap-6 gap-4"
			>
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
						{trendSlot(trend, t("overview.trendTitle"))}
					</div>
					<BreakdownCard
						title={t("overview.breakdownTitle")}
						slices={breakdown.map((slice) => ({
							label: t(`downtimeReasons.${slice.label}`),
							value: slice.value,
						}))}
					/>
				</div>
			</TabsContent>
			<TabsContent value="work-orders">
				<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
					<div className="grid grid-cols-1">
						{trendSlot(workOrdersTrend, t("overview.workOrdersTrendTitle"))}
					</div>
					<RecentTableCard workOrders={workOrders.slice(0, RECENT_ROWS)} />
				</div>
			</TabsContent>
		</Tabs>
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

/** Placeholder of the overview tab in its final shape. The route sets it as pendingComponent. */
export function OverviewPageSkeleton() {
	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-48" />
			</div>
			<KpiRowSkeleton count={KPI_COUNT} className={KPI_GRID} />
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2 grid grid-cols-1">
					<TrendCardSkeleton />
				</div>
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

### File: src/features/overview/components/recent-table-card.tsx

```tsx
// The newest work orders in the work orders tab of the home, in a table inside a card.
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
```

### Messages

Add this group to `messages` in `src/shared/i18n/messages.ts`. Write the titles for your domain.
The page also reads the `workOrders` group of tables.md.

```ts
overview: {
	title: "Overview",
	tabOverview: "Overview",
	setupTitle: "Start here",
	setupText: "Add your first work order to fill this page.",
	loadError: "The overview did not load. Check the connection and try again.",
	trendTitle: "Units per day",
	workOrdersTrendTitle: "New work orders per day",
	trendError: "This period did not load.",
	breakdownTitle: "Downtime by reason, last 30 days",
	recentTitle: "Newest work orders",
	seeAll: "See all",
},
```
