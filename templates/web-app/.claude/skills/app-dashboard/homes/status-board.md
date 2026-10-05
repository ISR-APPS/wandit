# Home status-board

A board of asset tiles with a live status. The header counts the assets per status.
KPIs sit above the board. The events trend and the alerts sit below it.

## Needs

4 to 24 assets with a live status: machines, rooms, vehicles, devices. Each asset has one live number.

## Header

`PageHeader`: the title, and one status Badge with its count per status in the description.

## Grid

```text
lg (main 64rem or wider)                     375 px
+---------+---------+---------+---------+    +-----------+
| KPI     | KPI     | KPI     | KPI     |    | KPI x4    |
+---------+---------+---------+---------+    +-----+-----+
| Assets                       See all  |    |tile |tile |
| [A1][A2][A3][A4][A5][A6]              |    |tile |tile |
| [A7][A8][A9]...   (at most 24 tiles)  |    |tile |tile |
+-----------------------------+---------+    +-----+-----+
| Events trend 2/3            | Alerts  |    | Trend     |
|                             | 1/3     |    | Alerts    |
+-----------------------------+---------+    +-----------+
```

Tiles: 2 columns on a phone, 4 from 42rem, 6 from 64rem. More than 24 assets: 23 tiles and one "more" tile.
Keep the order of the list query, so each asset keeps its place on the board.
Assets with a zone column: one board card per zone, each with at most 24 tiles.

## Slots

| Slot | Metric kind |
|---|---|
| KPI | 4 counts or rates of the fleet: running, down, the output today, the use rate. |
| Asset tile | The name, the status, one live number, and a thin bar when the asset has a real target. |
| Events trend | The status events or the output per day, with the period control. |
| Alerts | The assets in a bad status now, newest change first. |

Examples: a factory (machines; units this hour against the hourly target; stops per day). A hotel (rooms;
guests in the room; check-ins per day; rooms out of order).

## Fallback

Fewer than 4 assets, or no live status: use focus-queue.

## Code

SKILL.md gives the shared rules: states, numbers, charts, RTL, and 375 px.
`KpiRow` and `TrendCard` come from the kpi and chart files.
This home has no breakdown slot. Do not write `breakdown-card.tsx` of the chart file.
The queries come from data.md. Rename the slot names as its section 5 shows.
Then run `pnpm exec biome check --write` on the changed files, because the new names change the import order.
The page translates the `labelKey` of each KPI.
The asset entity is `assets`, built like the work orders of tables.md. In the factory of data.md, the assets are the machines.
`Asset` has the tables.md column names: `id`, `name`, `status`, `reading`, `target`, and `changed_at`.
`reading` is the live number, and `target` is a number or null. `changed_at` is the ISO time of the last status change.
The feature exports `assetsQueryOptions`, `Asset`, `ASSET_STATUSES`, and `ASSET_STATUS_BADGE`,
and the status labels are the `assets.statuses` messages, as in tables.md.
Rename them and the `/app/assets` routes for your entity. `down` and `maintenance` are the alert statuses.

### File: src/routes/app/index.tsx

```tsx
// Route of the home page (/app). The /app layout checks the session first.
// The loader fills the cache of every home query, so the page renders with no spinner.
import { createFileRoute } from "@tanstack/react-router";
import { assetsQueryOptions } from "~/features/assets";
import {
	DEFAULT_DAYS,
	dailySeriesQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
} from "~/features/overview";

/** The home page. It waits for every home query, then renders OverviewPage. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(dailySeriesQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(assetsQueryOptions()),
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
// The home page (home=status-board): KPIs, the board of asset tiles, then the events trend and alerts.
// The /app index route renders it after its loader, so every query is in the cache.
// The asset query and the KPI query refresh on a timer. The grids use @container/main queries.
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ASSET_STATUS_BADGE,
	ASSET_STATUSES,
	assetsQueryOptions,
} from "~/features/assets";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	dailySeriesQueryOptions,
	overviewKpisQueryOptions,
} from "../api/overview.queries";
import { AlertsCard, AlertsCardSkeleton } from "./alerts-card";
import { AssetTiles, AssetTilesSkeleton } from "./asset-tiles";
import { KpiRow, KpiRowSkeleton } from "./kpi-row";
import { TrendCard, TrendCardSkeleton } from "./trend-card";

/** Period of the trend on the first visit, in days. The route loader prefetches it. */
export const DEFAULT_DAYS = 30;

// Statuses change during a shift. A refresh each 30 s keeps the statuses current with no socket.
const LIVE_REFRESH_MS = 30_000;

// This home shows the first 4 rows of the KPI query. The skeleton shows the same count.
const KPI_COUNT = 4;

const KPI_GRID = "grid-cols-1 @xl/main:grid-cols-2 @5xl/main:grid-cols-4";

/** The home of /app. Each card reads the cache that the route loader filled. */
export function OverviewPage() {
	const { t, locale } = useT();
	// The KPIs count the same assets, so they refresh at the same rate as the board.
	const { data: kpis } = useSuspenseQuery({
		...overviewKpisQueryOptions(),
		refetchInterval: LIVE_REFRESH_MS,
	});
	const { data: assets } = useSuspenseQuery({
		...assetsQueryOptions(),
		refetchInterval: LIVE_REFRESH_MS,
	});
	const [days, setDays] = useState(DEFAULT_DAYS);
	// A click changes the period, so the trend reads with useQuery. The old points stay until the new ones load.
	const trend = useQuery({
		...dailySeriesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const countFormat = new Intl.NumberFormat(locale);
	const alertAssets = assets
		.filter(
			(asset) => asset.status === "down" || asset.status === "maintenance",
		)
		.sort(
			(first, second) =>
				Date.parse(second.changed_at) - Date.parse(first.changed_at),
		);

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("overview.title")}
				description={
					<span className="flex flex-wrap gap-2 pt-1">
						{ASSET_STATUSES.map((status) => (
							<Badge key={status} variant={ASSET_STATUS_BADGE[status]}>
								{t(`assets.statuses.${status}`)}
								<span className="tabular-nums">
									{countFormat.format(
										assets.filter((asset) => asset.status === status).length,
									)}
								</span>
							</Badge>
						))}
					</span>
				}
			/>
			{/* No asset yet means a first visit: the setup card takes the place of the KPI band. */}
			{assets.length === 0 ? (
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
			<AssetTiles assets={assets} />
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
				<AlertsCard assets={alertAssets} />
			</div>
		</div>
	);
}

// The first visit: no asset exists yet. Give one button per real first action, 2 to 4.
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
					<Link to="/app/assets">{t("overview.addAsset")}</Link>
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
				<Skeleton className="h-5 w-72 max-w-full" />
			</div>
			<KpiRowSkeleton count={KPI_COUNT} className={KPI_GRID} />
			<AssetTilesSkeleton />
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2 grid grid-cols-1">
					<TrendCardSkeleton />
				</div>
				<AlertsCardSkeleton />
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

### File: src/features/overview/components/asset-tiles.tsx

```tsx
// The board of the status-board home: one tile per asset with its status and its live number.
// OverviewPage passes every row of the asset query. Each tile links to the detail page of its asset.
// A board shows at most 24 tiles. With more assets, the last tile links to the full list.
import { Link } from "@tanstack/react-router";
import { ASSET_STATUS_BADGE, type Asset } from "~/features/assets";
import { useT } from "~/shared/i18n";
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
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";

// 24 tiles fill 4 rows of 6 at 1440 px. More assets: 23 tiles and one tile that opens the list.
const MAX_TILES = 24;

const TILE_GRID =
	"grid grid-cols-2 gap-3 @2xl/main:grid-cols-4 @5xl/main:grid-cols-6";

type AssetTilesProps = {
	/** Every row of the asset query, in the order of the query. */
	assets: Asset[];
};

/** The tiles in a card. No asset: one sentence and the add action. */
export function AssetTiles({ assets }: AssetTilesProps) {
	const { t, locale } = useT();
	const numberFormat = new Intl.NumberFormat(locale);
	const signedFormat = new Intl.NumberFormat(locale, { signDisplay: "always" });
	// One tile goes to the "more" link when the fleet does not fit.
	const shown =
		assets.length > MAX_TILES ? assets.slice(0, MAX_TILES - 1) : assets;
	const hiddenCount = assets.length - shown.length;
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">
					{t("overview.boardTitle")}
				</CardTitle>
				<CardAction>
					<Button asChild variant="ghost" size="sm">
						<Link to="/app/assets">
							{t("overview.seeAll")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{assets.length === 0 ? (
					<div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
						<p className="text-muted-foreground text-sm">
							{t("overview.boardEmpty")}
						</p>
						<Button asChild variant="outline" size="sm">
							<Link to="/app/assets">{t("overview.addAsset")}</Link>
						</Button>
					</div>
				) : (
					<div className={TILE_GRID}>
						{shown.map((asset) => (
							<Link
								key={asset.id}
								to="/app/assets/$id"
								params={{ id: asset.id }}
								className="flex min-w-0 flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-accent"
							>
								<span
									dir="auto"
									className="max-w-full self-start truncate font-medium text-sm"
								>
									{asset.name}
								</span>
								<Badge variant={ASSET_STATUS_BADGE[asset.status]}>
									{t(`assets.statuses.${asset.status}`)}
								</Badge>
								<span className="font-display text-2xl tabular-nums">
									{numberFormat.format(asset.reading)}
								</span>
								{/* mt-auto puts the bar at the bottom, so the numbers of one row stay at one height. */}
								{asset.target !== null ? (
									<Progress
										value={asset.reading}
										max={asset.target}
										className="mt-auto h-1"
										aria-label={t("overview.readingOfTarget")}
									/>
								) : null}
							</Link>
						))}
						{hiddenCount > 0 ? (
							<Link
								to="/app/assets"
								className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-3 text-muted-foreground text-sm transition-colors hover:bg-accent"
							>
								{/* dir="ltr" keeps the plus sign in front of the number in Arabic. */}
								<span
									dir="ltr"
									className="font-display text-2xl text-foreground tabular-nums"
								>
									{signedFormat.format(hiddenCount)}
								</span>
								{t("overview.moreAssets")}
							</Link>
						) : null}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

/** Placeholder of AssetTiles in its final size: 2 rows of tiles. OverviewPageSkeleton renders it. */
export function AssetTilesSkeleton() {
	const tiles = Array.from({ length: 12 }, (_, tile) => tile);
	return (
		<Card className="gap-4 px-6">
			<Skeleton className="h-4 w-32" />
			<div className={TILE_GRID}>
				{tiles.map((tile) => (
					<Skeleton key={tile} className="h-28" />
				))}
			</div>
		</Card>
	);
}
```

### File: src/features/overview/components/alerts-card.tsx

```tsx
// The alerts of the status-board home: the assets in a bad status now, newest change first.
// OverviewPage filters and sorts the asset rows. Each name links to the detail page of its asset.
// No alert is the normal state, so the empty form has a sentence and no action.
import { Link } from "@tanstack/react-router";
import { ASSET_STATUS_BADGE, type Asset } from "~/features/assets";
import { useT } from "~/shared/i18n";
import { formatRelativeTime } from "~/shared/lib/relative-time";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

// Six alerts match the height of the trend beside the card.
const ALERT_ROWS = 6;

type AlertsCardProps = {
	/** Assets in an alert status, newest status change first. */
	assets: Asset[];
};

/** One row per alert: the asset, the time of its status change, and the status. */
export function AlertsCard({ assets }: AlertsCardProps) {
	const { t, locale } = useT();
	const now = Date.now();
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="font-medium text-sm">
					{t("overview.alertsTitle")}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{assets.length === 0 ? (
					<p className="m-auto text-center text-muted-foreground text-sm">
						{t("overview.alertsEmpty")}
					</p>
				) : (
					<ul className="grid gap-3">
						{assets.slice(0, ALERT_ROWS).map((asset) => (
							<li key={asset.id} className="flex items-center gap-3">
								<div className="grid min-w-0 flex-1">
									<Link
										to="/app/assets/$id"
										params={{ id: asset.id }}
										dir="auto"
										className="max-w-full justify-self-start truncate font-medium text-sm hover:underline"
									>
										{asset.name}
									</Link>
									<span className="text-muted-foreground text-xs tabular-nums">
										{formatRelativeTime(asset.changed_at, now, locale)}
									</span>
								</div>
								<Badge variant={ASSET_STATUS_BADGE[asset.status]}>
									{t(`assets.statuses.${asset.status}`)}
								</Badge>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

/** Placeholder of AlertsCard in its final size. OverviewPageSkeleton renders it. */
export function AlertsCardSkeleton() {
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
The page also reads the `assets` group of your asset feature.

```ts
overview: {
	title: "Overview",
	setupTitle: "Start here",
	setupText: "Add your first machine to fill the board.",
	loadError: "The overview did not load. Check the connection and try again.",
	trendTitle: "Units per day",
	trendError: "This period did not load.",
	boardTitle: "Machines",
	boardEmpty: "No machines yet. Add the first one to fill the board.",
	addAsset: "Add a machine",
	moreAssets: "more machines",
	readingOfTarget: "Output against the target",
	alertsTitle: "Alerts",
	alertsEmpty: "All machines run normally.",
	seeAll: "See all",
},
```
