// The home behind login: the live floor of the restaurant (the status-board home of the app-dashboard skill).
// The /app route renders it after its loader. It places the status line, one wall per zone, the heat panel,
// the attention list, and the table panel. The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	floorQueryOptions,
	ordersQueryOptions,
	upcomingBookingsQueryOptions,
	ZONES,
	type Zone,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { floorKpisQueryOptions } from "../api/floor-stats.queries";
import { AttentionPanel } from "./attention-panel";
import { FloorStatusLine } from "./floor-status-line";
import { OrdersHeatPanel } from "./orders-heat-panel";
import { TableSheet } from "./table-sheet";
import { TableWall } from "./table-wall";

/** The period of the heat panel on the first load, in days. */
export const DEFAULT_DAYS = 30;

/**
 * The share of the floor of each zone from the 4xl container width: the dining room fills a row of 5 tiles,
 * the terrace and the bar share the next row 3 to 2. The tile gap equals the zone gap, so the columns line up.
 * Below that width each zone takes a full row, with a column count that leaves no empty slot in its last row.
 */
const ZONE_LAYOUT = {
	dining: {
		span: "@4xl/main:col-span-5",
		columns: "@2xl/main:grid-cols-4 @3xl/main:grid-cols-5",
	},
	terrace: {
		span: "@4xl/main:col-span-3",
		columns: "@2xl/main:grid-cols-3",
	},
	bar: {
		span: "@4xl/main:col-span-2",
		columns: "@2xl/main:grid-cols-4 @4xl/main:grid-cols-2",
	},
} satisfies Record<Zone, { span: string; columns: string }>;

type FloorPageProps = {
	/** The `table` search param: the id of the table whose panel is open. */
	openTableId: string | undefined;
};

/** The floor wall opens the page. The counts sit in the header line; there are no figure panels on top. */
export function FloorPage({ openTableId }: FloorPageProps) {
	const { t } = useT();
	const navigate = useNavigate();
	const { data: board } = useSuspenseQuery(floorQueryOptions());
	const { data: kpis } = useSuspenseQuery(floorKpisQueryOptions());
	const { data: bookings } = useSuspenseQuery(upcomingBookingsQueryOptions());
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const [days, setDays] = useState(DEFAULT_DAYS);
	const now = Date.now();
	const openEntry = board.find((entry) => entry.table.id === openTableId);
	// The panel keeps the last table while it slides out, so its content does not vanish mid-animation.
	const [shownEntry, setShownEntry] = useState(openEntry);
	if (openEntry && openEntry !== shownEntry) {
		setShownEntry(openEntry);
	}
	const sheetEntry = openEntry ?? shownEntry;
	const sheetChecks = orders.filter(
		(order) =>
			order.tableId === sheetEntry?.table.id &&
			order.id !== sheetEntry.openOrder?.id,
	);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("floor.title")}
				description={<FloorStatusLine entries={board} />}
				actions={
					<Button asChild>
						<Link to="/app/order">{t("floor.newOrder")}</Link>
					</Button>
				}
			/>
			<div className="grid @4xl/main:grid-cols-5 grid-cols-1 gap-x-3 gap-y-6">
				{ZONES.map((zone) => (
					<div key={zone} className={ZONE_LAYOUT[zone].span}>
						<TableWall
							zone={zone}
							entries={board.filter((entry) => entry.table.zone === zone)}
							columnsClassName={ZONE_LAYOUT[zone].columns}
							now={now}
						/>
					</div>
				))}
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2">
					<OrdersHeatPanel kpis={kpis} days={days} onDaysChange={setDays} />
				</div>
				<AttentionPanel entries={board} bookings={bookings} now={now} />
			</div>
			<TableSheet
				entry={sheetEntry}
				checks={sheetChecks}
				open={openEntry !== undefined}
				onClose={() => navigate({ to: "/app", search: {}, resetScroll: false })}
				now={now}
			/>
		</div>
	);
}

// Placeholder tiles of the skeleton. Fixed keys, because the tiles never reorder.
const SKELETON_TILES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the floor loader runs: the header, the walls, and the bottom row in their final shape. */
export function FloorPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid gap-3">
				<Skeleton className="h-5 w-40" />
				<div className="grid @2xl/main:grid-cols-4 @4xl/main:grid-cols-5 grid-cols-2 gap-3">
					{SKELETON_TILES.map((key, index) => (
						<Skeleton
							key={key}
							className={index >= 6 ? "@2xl/main:block hidden h-32" : "h-32"}
						/>
					))}
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<Card className="@4xl/main:col-span-2">
					<CardHeader>
						<Skeleton className="h-5 w-36" />
					</CardHeader>
					<CardContent className="grid gap-4">
						<Skeleton className="h-16 w-72 max-w-full" />
						<Skeleton className="h-32 w-full" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-32" />
					</CardHeader>
					<CardContent className="grid gap-3">
						<Skeleton className="h-11 w-full" />
						<Skeleton className="h-11 w-full" />
						<Skeleton className="h-11 w-full" />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

/** Error state of the floor when the loader fails. Try again runs the loader again. */
export function FloorPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("floor.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
