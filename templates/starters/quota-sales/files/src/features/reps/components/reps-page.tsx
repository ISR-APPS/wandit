// The reps list behind login: the page header, the pace tabs, the territory filter, and the searchable table.
// The /app/reps route renders it after its loader. The route also uses the skeleton and the error below.
// A rep name opens the page of that rep. On a narrow page the first cell shows the key numbers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	AttainmentBar,
	FIRST_COLUMN_WHEN_NARROW,
	fillMessage,
	moneyFormat,
	NARROW_ONLY,
	PACE_STATUSES,
	PaceBadge,
	type PaceStatus,
	PageError,
	percentFormat,
	pluralOf,
	RepAvatar,
	TOUCH_TAB_TRIGGER,
	WRAPPING_TABS_LIST,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type RepSummary, repsQueryOptions } from "../api/reps.queries";

// The value of the territory Select that shows every territory.
const ALL_TERRITORIES = "all";

// The 5th column (Orders) shows only from the 5xl main width (64rem). Below it, five columns do not fit:
// at 1024 px with the sidebar open, the column is cut. The order count then sits under the booked amount.
const ORDERS_COLUMN_WHEN_WIDE =
	"[&_td:nth-child(5)]:hidden [&_th:nth-child(5)]:hidden @5xl/main:[&_td:nth-child(5)]:table-cell @5xl/main:[&_th:nth-child(5)]:table-cell";

/** The list page. The territory Select and the pace tab filter the rows; then DataTable searches and sorts them. */
export function RepsPage() {
	const { t, locale } = useT();
	const { data: board } = useSuspenseQuery(repsQueryOptions());
	const [status, setStatus] = useState<PaceStatus | "all">("all");
	const [territoryId, setTerritoryId] = useState(ALL_TERRITORIES);

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const percent = percentFormat(locale);
	const territoryReps =
		territoryId === ALL_TERRITORIES
			? board.reps
			: board.reps.filter((rep) => rep.territoryId === territoryId);
	// A tab shows only for a pace that has reps in the chosen territory. Its count is the count of the table.
	const tabs = PACE_STATUSES.map((value) => ({
		value,
		count: territoryReps.filter((rep) => rep.status === value).length,
	})).filter((tab) => tab.count > 0);
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? territoryReps
			: territoryReps.filter((rep) => rep.status === activeStatus);

	// The bar and "65%" of a rep. The Attainment column and the narrow first cell both show them.
	function renderAttainment(row: RepSummary) {
		return (
			<>
				<AttainmentBar
					attainment={row.attainment}
					pace={board.progress.pace}
					status={row.status}
					label={fillMessage(t("reps.ofTarget"), {
						value: percent.format(row.attainment),
					})}
					className="w-16"
				/>
				<span className="w-10 text-end font-medium tabular-nums">
					{percent.format(row.attainment)}
				</span>
			</>
		);
	}

	const columns: DataTableColumn<RepSummary>[] = [
		{
			id: "rep",
			header: t("reps.rep"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<RepAvatar name={row.name} />
					<div className="grid min-w-0 flex-1 justify-items-start gap-0.5">
						<Link
							to="/app/reps/$repId"
							params={{ repId: row.id }}
							className="font-medium hover:underline"
						>
							<bdi>{row.name}</bdi>
						</Link>
						<span className="whitespace-normal @2xl/main:whitespace-nowrap text-muted-foreground text-xs">
							{`${row.territoryName} · ${t(`roles.${row.role}`)}`}
						</span>
						<div className={cn("flex items-center gap-2 pt-1", NARROW_ONLY)}>
							{renderAttainment(row)}
						</div>
					</div>
					<div
						className={cn("grid shrink-0 justify-items-end gap-1", NARROW_ONLY)}
					>
						<span className="font-medium tabular-nums">
							{money.format(row.booked)}
						</span>
						<PaceBadge status={row.status} />
					</div>
				</div>
			),
		},
		{
			id: "attainment",
			header: t("reps.attainment"),
			sortValue: (row) => row.attainment,
			cell: (row) => (
				<div className="flex items-center gap-3">{renderAttainment(row)}</div>
			),
		},
		{
			id: "status",
			header: t("reps.status"),
			sortValue: (row) => PACE_STATUSES.indexOf(row.status),
			cell: (row) => <PaceBadge status={row.status} />,
		},
		{
			id: "booked",
			header: t("reps.booked"),
			align: "end",
			sortValue: (row) => row.booked,
			cell: (row) => (
				<div className="grid justify-items-end">
					<span className="font-medium">{money.format(row.booked)}</span>
					<span className="whitespace-nowrap text-muted-foreground text-xs">
						{fillMessage(t("reps.ofAmount"), {
							amount: money.format(row.target),
						})}
						{/* The Orders column shows from the 5xl width. Below it, the count joins this line. */}
						<span className="@5xl/main:hidden">
							{` · ${fillMessage(
								t(`reps.orderCount.${pluralOf(locale, row.orders)}`),
								{ count: number.format(row.orders) },
							)}`}
						</span>
					</span>
				</div>
			),
		},
		{
			id: "orders",
			header: t("reps.orders"),
			align: "end",
			sortValue: (row) => row.orders,
			cell: (row) => number.format(row.orders),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("reps.title")}
				description={`${t("reps.description")} · ${fillMessage(
					t("calendar.quarterDay"),
					{
						quarter: board.quarterLabel,
						day: number.format(board.progress.elapsedDays + 1),
						total: number.format(board.progress.totalDays),
					},
				)}`}
			/>
			<Card>
				<CardContent
					className={cn(FIRST_COLUMN_WHEN_NARROW, ORDERS_COLUMN_WHEN_WIDE)}
				>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) => `${row.name} ${row.territoryName}`}
						noResults={t("reps.noResults")}
						toolbar={
							<>
								<Select value={territoryId} onValueChange={setTerritoryId}>
									<SelectTrigger
										className="w-full sm:w-48"
										aria-label={t("reps.territory")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_TERRITORIES}>
											{t("reps.allTerritories")}
										</SelectItem>
										{board.territories.map((territory) => (
											<SelectItem key={territory.id} value={territory.id}>
												{territory.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Tabs
									value={activeStatus}
									onValueChange={(value) =>
										setStatus(
											PACE_STATUSES.find((option) => option === value) ?? "all",
										)
									}
								>
									{/* The counts use opacity, not a muted color: muted text fails on the filled active tab. */}
									<TabsList className={WRAPPING_TABS_LIST}>
										<TabsTrigger value="all" className={TOUCH_TAB_TRIGGER}>
											{t("reps.all")}
											<span className="tabular-nums opacity-70">
												{number.format(territoryReps.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger
												key={tab.value}
												value={tab.value}
												className={TOUCH_TAB_TRIGGER}
											>
												{t(`pace.${tab.value}`)}
												<span className="tabular-nums opacity-70">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
							</>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function RepsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-4 w-80" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<div className="flex flex-wrap gap-2">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						<Skeleton className="h-9 w-48" />
						<Skeleton className="h-9 w-64" />
					</div>
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list and of the rep page when a loader fails. The route sets it as errorComponent. */
export function RepsPageError() {
	const { t } = useT();
	return <PageError message={t("reps.loadError")} />;
}
