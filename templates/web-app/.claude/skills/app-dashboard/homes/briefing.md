# Home briefing

A morning briefing: a greeting, today's date, and one sentence about the day. Below: today's progress
beside the KPIs, today's agenda beside the trend, and the newest rows.

## Needs

Items with a time today: appointments, shifts, deliveries, classes, jobs. The day is the unit of work.

## Header

`PageHeader`: the title is the greeting with the first name of the profile. The description is today's date
(Intl, `dateStyle: "full"`) and one sentence that the page computes from the data:

1. Late open rows exist: "Late now: 3" and a link to the list.
2. Else, the next open row of today: "Next:" with its name (a link) and its time.
3. Else: "Nothing else is planned today."

Never write a sentence that the data does not give.

## Grid

5 columns from 56rem.

```text
lg (main 56rem or wider)                     375 px
+--------------+---------+---------+         +-----------+
| Today 2/5    | KPI     | KPI     |         | Today     |
| 5 / 8 done   +---------+---------+         | KPI       |
| [=====---]   | KPI     | KPI     |         | KPI       |
+--------------+---------+---------+         | KPI       |
| Agenda 2/5   | Trend 3/5         |         | KPI       |
| 09:00 ...    |                   |         | Agenda    |
| 11:30 ...    |                   |         | Trend     |
+--------------+-------------------+         | Newest    |
| Newest rows (full width)         |         +-----------+
+----------------------------------+
```

## Slots

| Slot | Metric kind |
|---|---|
| Today | The rows due today: how many are done, how many are late, how many are left. |
| KPI | 4 counts or rates of the week or the month. |
| Agenda | Today's rows by time, with their status. |
| Trend | The main activity per day, with the period control. |
| Newest rows | The newest rows of the main entity, with a status. |

Examples: a clinic (appointments today; visits this week, no-shows; visits per day; newest patients).
A delivery firm (deliveries today; on-time rate; deliveries per day; newest orders).

## Fallback

No row with a time today: use kpi-band.

## Code

SKILL.md gives the shared rules: states, numbers, charts, RTL, and 375 px.
`KpiRow` and `TrendCard` come from the kpi and chart files.
This home has no breakdown slot. Do not write `breakdown-card.tsx` of the chart file.
The queries come from data.md. Rename the slot names as its section 5 shows.
Then run `pnpm exec biome check --write` on the changed files, because the new names change the import order.
The page translates the `labelKey` of each KPI. The first name comes from `profileQueryOptions`.
The main entity is the work orders of tables.md. The code uses its exports with no change:
`workOrdersQueryOptions`, `WorkOrder`, `WORK_ORDER_STATUS_BADGE`, the `workOrders` messages, the `/app/work-orders` routes,
and `formatRelativeTime`. For another entity, rename them as tables.md does.
`reference` is the main text column, and `product` is its second line.
`done` is the closed status.
A due date that can be null: leave those rows out of today, and never count them as late.

### File: src/routes/app/index.tsx

```tsx
// Route of the home page (/app). The /app layout checks the session first.
// The loader fills the cache of every home query and of the profile, so the page renders with no spinner.
// The page gets the user id from the session of the layout.
import { createFileRoute } from "@tanstack/react-router";
import {
	DEFAULT_DAYS,
	dailySeriesQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
} from "~/features/overview";
import { profileQueryOptions } from "~/features/profile";
import { workOrdersQueryOptions } from "~/features/work-orders";

/** The home page. It waits for every home query, then renders OverviewPage. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(dailySeriesQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(workOrdersQueryOptions()),
			context.queryClient.query(profileQueryOptions(context.session.user.id)),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewRoute,
});

function OverviewRoute() {
	const { session } = Route.useRouteContext();
	return <OverviewPage userId={session.user.id} />;
}
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
// The home page (home=briefing): a greeting, the date, one sentence, then today and the trend.
// The /app index route renders it after its loader, so every query and the profile are in the cache.
// The sentence and the today cards come from the rows of the list query. Grids use @container/main queries.
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { profileQueryOptions } from "~/features/profile";
import { workOrdersQueryOptions } from "~/features/work-orders";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	dailySeriesQueryOptions,
	overviewKpisQueryOptions,
} from "../api/overview.queries";
import { AgendaCard, AgendaCardSkeleton } from "./agenda-card";
import { KpiRow, KpiRowSkeleton } from "./kpi-row";
import { RecentTableCard, RecentTableCardSkeleton } from "./recent-table-card";
import { TodayCard, TodayCardSkeleton } from "./today-card";
import { TrendCard, TrendCardSkeleton } from "./trend-card";

/** Period of the trend on the first visit, in days. The route loader prefetches it. */
export const DEFAULT_DAYS = 30;

// This home shows the first 4 rows of the KPI query. The skeleton shows the same count.
const KPI_COUNT = 4;

// Six rows keep the table short. The card links to the full list.
const RECENT_ROWS = 6;

// 2x2 beside the today card. The two rows share the height of that card.
const KPI_GRID =
	"grid-cols-1 @xl/main:grid-cols-2 @xl/main:grid-rows-2 @4xl/main:col-span-3";

type OverviewPageProps = {
	/** The auth user id of the session. It keys the profile query that gives the first name. */
	userId: string;
};

/** The home of /app. Each card reads the cache that the route loader filled. */
export function OverviewPage({ userId }: OverviewPageProps) {
	const { t, locale } = useT();
	const { data: profile } = useSuspenseQuery(profileQueryOptions(userId));
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const { data: workOrders } = useSuspenseQuery(workOrdersQueryOptions());
	const [days, setDays] = useState(DEFAULT_DAYS);
	// A click changes the period, so the trend reads with useQuery. The old points stay until the new ones load.
	const trend = useQuery({
		...dailySeriesQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	const now = new Date();
	const firstName = profile.fullName.trim().split(/\s+/)[0] ?? "";
	// LIMIT: the sentence and the today cards read the newest 1,000 rows of the list query. Upgrade: a query of the open rows by due date.
	// Today is the local day of the browser, the same day as the user's clock.
	const todayWorkOrders = workOrders
		.filter((row) => new Date(row.due_at).toDateString() === now.toDateString())
		.sort(
			(first, second) => Date.parse(first.due_at) - Date.parse(second.due_at),
		);
	const lateCount = workOrders.filter(
		(row) => row.status !== "done" && Date.parse(row.due_at) < now.getTime(),
	).length;
	const nextWorkOrder = todayWorkOrders.find(
		(row) => row.status !== "done" && Date.parse(row.due_at) >= now.getTime(),
	);
	const timeFormat = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader
				title={
					firstName
						? `${t("overview.greeting")} ${firstName}`
						: t("overview.greeting")
				}
				description={
					<>
						{new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(now)}
						{" · "}
						{lateCount > 0 ? (
							<>
								{t("overview.lateNow")}{" "}
								<span className="font-medium text-destructive tabular-nums">
									{new Intl.NumberFormat(locale).format(lateCount)}
								</span>
								{" · "}
								<Link
									to="/app/work-orders"
									className="font-medium text-foreground underline underline-offset-4"
								>
									{t("overview.seeList")}
								</Link>
							</>
						) : nextWorkOrder ? (
							<>
								{t("overview.nextUp")}{" "}
								<Link
									to="/app/work-orders/$id"
									params={{ id: nextWorkOrder.id }}
									dir="auto"
									className="font-medium text-foreground underline underline-offset-4"
								>
									{nextWorkOrder.reference}
								</Link>{" "}
								<span className="tabular-nums">
									{timeFormat.format(new Date(nextWorkOrder.due_at))}
								</span>
							</>
						) : (
							t("overview.dayClear")
						)}
					</>
				}
			/>
			<div className="grid @4xl/main:grid-cols-5 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2 grid grid-cols-1">
					<TodayCard workOrders={todayWorkOrders} now={now.getTime()} />
				</div>
				{/* No row yet means a first visit: the setup card takes the place of the KPIs. */}
				{workOrders.length === 0 ? (
					<div className="@4xl/main:col-span-3 grid grid-cols-1">
						<SetupCard />
					</div>
				) : (
					<KpiRow
						items={kpis.slice(0, KPI_COUNT).map(({ labelKey, ...kpi }) => ({
							...kpi,
							label: t(labelKey),
						}))}
						className={KPI_GRID}
					/>
				)}
				<div className="@4xl/main:col-span-2 grid grid-cols-1">
					<AgendaCard workOrders={todayWorkOrders} now={now.getTime()} />
				</div>
				<div className="@4xl/main:col-span-3 grid grid-cols-1">
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
				<div className="@4xl/main:col-span-5 grid grid-cols-1">
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
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-5 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2 grid grid-cols-1">
					<TodayCardSkeleton />
				</div>
				<KpiRowSkeleton count={KPI_COUNT} className={KPI_GRID} />
				<div className="@4xl/main:col-span-2 grid grid-cols-1">
					<AgendaCardSkeleton />
				</div>
				<div className="@4xl/main:col-span-3 grid grid-cols-1">
					<TrendCardSkeleton />
				</div>
				<div className="@4xl/main:col-span-5 grid grid-cols-1">
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

### File: src/features/overview/components/today-card.tsx

```tsx
// The today card of the briefing home: the work orders due today that are done, late, and left.
// OverviewPage passes today's rows (local day of the browser) and the render time.
// The bar shows the done rows of all rows due today.
import { Link } from "@tanstack/react-router";
import type { WorkOrder } from "~/features/work-orders";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";

type TodayCardProps = {
	/** Rows of the list query that are due today, sorted by time. */
	workOrders: WorkOrder[];
	/** The render time in ms (from OverviewPage), so the card and the agenda agree on "late". */
	now: number;
};

/** Done of planned, with a bar, then the late and left counts. No row today: one sentence and the add action. */
export function TodayCard({ workOrders, now }: TodayCardProps) {
	const { t, locale } = useT();
	const numberFormat = new Intl.NumberFormat(locale);
	const doneCount = workOrders.filter((row) => row.status === "done").length;
	const lateCount = workOrders.filter(
		(row) => row.status !== "done" && Date.parse(row.due_at) < now,
	).length;
	const leftCount = workOrders.length - doneCount - lateCount;
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">
					{t("overview.todayTitle")}
				</CardTitle>
				<CardDescription>{t("overview.todayDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				{workOrders.length === 0 ? (
					<div className="m-auto flex flex-col items-center gap-3 text-center">
						<p className="text-muted-foreground text-sm">
							{t("overview.todayEmpty")}
						</p>
						<Button asChild variant="outline" size="sm">
							<Link to="/app/work-orders">{t("workOrders.add")}</Link>
						</Button>
					</div>
				) : (
					<>
						<p className="font-display text-4xl tabular-nums">
							{numberFormat.format(doneCount)}
							<span className="font-normal font-sans text-base text-muted-foreground">
								{" / "}
								{numberFormat.format(workOrders.length)}
							</span>
						</p>
						<Progress
							value={doneCount}
							max={workOrders.length}
							aria-label={t("overview.todayDescription")}
						/>
						<dl className="mt-auto grid grid-cols-2 gap-3 text-sm">
							<div className="grid gap-0.5">
								<dt className="text-muted-foreground">
									{t("overview.lateToday")}
								</dt>
								{/* Red only when a row is late. A zero is the normal state. */}
								<dd
									className={cn(
										"font-medium tabular-nums",
										lateCount > 0 && "text-destructive",
									)}
								>
									{numberFormat.format(lateCount)}
								</dd>
							</div>
							<div className="grid gap-0.5">
								<dt className="text-muted-foreground">{t("overview.left")}</dt>
								<dd className="font-medium tabular-nums">
									{numberFormat.format(leftCount)}
								</dd>
							</div>
						</dl>
					</>
				)}
			</CardContent>
		</Card>
	);
}

/** Placeholder of TodayCard in its final size. OverviewPageSkeleton renders it. */
export function TodayCardSkeleton() {
	return (
		<Card className="gap-4 px-6">
			<Skeleton className="h-4 w-24" />
			<Skeleton className="h-10 w-28" />
			<Skeleton className="h-2 w-full" />
			<Skeleton className="h-10 w-full" />
		</Card>
	);
}
```

### File: src/features/overview/components/agenda-card.tsx

```tsx
// The agenda of the briefing home: today's work orders by time, with their status.
// OverviewPage passes today's rows, sorted by time, and the render time.
// An open row past its time shows the time in the destructive color.
import { Link } from "@tanstack/react-router";
import {
	WORK_ORDER_STATUS_BADGE,
	type WorkOrder,
} from "~/features/work-orders";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

type AgendaCardProps = {
	/** Rows of the list query that are due today, sorted by time. */
	workOrders: WorkOrder[];
	/** The render time in ms (from OverviewPage), so the agenda and the today card agree on "late". */
	now: number;
};

/** One row per work order: the time, the reference, and the status. No row today: one sentence and the add action. */
export function AgendaCard({ workOrders, now }: AgendaCardProps) {
	const { t, locale } = useT();
	const timeFormat = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">
					{t("overview.agendaTitle")}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{workOrders.length === 0 ? (
					<div className="m-auto flex flex-col items-center gap-3 text-center">
						<p className="text-muted-foreground text-sm">
							{t("overview.agendaEmpty")}
						</p>
						<Button asChild variant="outline" size="sm">
							<Link to="/app/work-orders">{t("workOrders.add")}</Link>
						</Button>
					</div>
				) : (
					<ol className="divide-y">
						{workOrders.map((workOrder) => {
							const isDone = workOrder.status === "done";
							const isLate = !isDone && Date.parse(workOrder.due_at) < now;
							return (
								<li
									key={workOrder.id}
									className="flex items-center gap-3 py-2.5"
								>
									<span
										className={cn(
											"w-18 shrink-0 whitespace-nowrap font-medium text-sm tabular-nums",
											isLate && "text-destructive",
										)}
									>
										{timeFormat.format(new Date(workOrder.due_at))}
									</span>
									<Link
										to="/app/work-orders/$id"
										params={{ id: workOrder.id }}
										dir="auto"
										className={cn(
											"me-auto min-w-0 truncate text-sm hover:underline",
											isDone && "text-muted-foreground",
										)}
									>
										{workOrder.reference}
									</Link>
									<Badge variant={WORK_ORDER_STATUS_BADGE[workOrder.status]}>
										{t(`workOrders.statuses.${workOrder.status}`)}
									</Badge>
								</li>
							);
						})}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

/** Placeholder of AgendaCard in its final size. OverviewPageSkeleton renders it. */
export function AgendaCardSkeleton() {
	return (
		<Card className="gap-4 px-6">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-64 w-full" />
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
	greeting: "Hello",
	lateNow: "Late now:",
	seeList: "See the list",
	nextUp: "Next:",
	dayClear: "Nothing else is planned today.",
	setupTitle: "Start here",
	setupText: "Add your first work order to fill this page.",
	loadError: "The overview did not load. Check the connection and try again.",
	trendTitle: "Units per day",
	trendError: "This period did not load.",
	todayTitle: "Today",
	todayDescription: "Work orders done of the work orders due today",
	todayEmpty: "Nothing is planned today.",
	agendaTitle: "Today's agenda",
	agendaEmpty: "No work order is due today.",
	lateToday: "Late today",
	left: "Left",
	recentTitle: "Newest work orders",
	seeAll: "See all",
},
```
