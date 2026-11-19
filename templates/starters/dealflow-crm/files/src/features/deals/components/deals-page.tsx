// The Deals page behind login: the header, the Board | Table views, a search, and an owner filter.
// The /app/deals route renders it after its loader. The route also uses the skeleton and the error below.
// The view and the stage tab live in the URL (?view=, ?stage=), so a board column can link to one stage of the table.
// It follows the kanban page anatomy of the kit: a board of stage columns that scrolls inside the page column.
import {
	DownloadSimpleIcon,
	FlagPennantIcon,
	KanbanIcon,
	TableIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	DEAL_STAGES,
	dayCountFormat,
	downloadCsv,
	fillMessage,
	isOpenStage,
	moneyFormat,
	STALLED_AFTER_DAYS,
	toCsv,
	WINNING_PATH,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import { RecordFilter } from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { dealsQueryOptions } from "../api/deals.queries";
import { BOARD_DAYS, buildBoard } from "../lib/board";
import { dealCsvColumns } from "../lib/deal-csv";
import { DEAL_VIEWS } from "../lib/deals-search";
import { BoardColumn } from "./board-column";
import { DealTable } from "./deal-table";

const routeApi = getRouteApi("/app/deals/");

/** The search and the owner filter cut the rows of both views. The table view also has stage tabs. */
export function DealsPage() {
	const { t, locale } = useT();
	const { data: deals } = useSuspenseQuery(dealsQueryOptions());
	const { view, stage } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const [query, setQuery] = useState("");
	const [ownerId, setOwnerId] = useState<string | null>(null);

	const number = new Intl.NumberFormat(locale);
	const compactMoney = moneyFormat(locale, "compact");
	const dayCount = dayCountFormat(locale);
	const now = Date.now();
	const activeView = view ?? "board";

	// One entry per rep that owns a deal, in name order.
	const owners = [
		...new Map(deals.map((deal) => [deal.ownerId, deal.ownerName])),
	]
		.sort((first, second) => first[1].localeCompare(second[1], locale))
		.map(([value, label]) => ({ value, label }));
	const needle = query.trim().toLocaleLowerCase(locale);
	const filtered = deals.filter(
		(deal) =>
			(ownerId === null || deal.ownerId === ownerId) &&
			`${deal.name} ${deal.companyName} ${deal.contactName}`
				.toLocaleLowerCase(locale)
				.includes(needle),
	);
	// A tab shows only for a stage that has rows after the filters.
	const tabs = DEAL_STAGES.map((value) => ({
		value,
		count: filtered.filter((deal) => deal.stage === value).length,
	})).filter((tab) => tab.count > 0);
	// A filter can empty the stage of the URL. Its tab then disappears, so the table shows all stages.
	const activeStage = tabs.some((tab) => tab.value === stage)
		? stage
		: undefined;
	const tableRows = activeStage
		? filtered.filter((deal) => deal.stage === activeStage)
		: filtered;
	const board = buildBoard(filtered, now);
	const openDeals = deals.filter((deal) => isOpenStage(deal.stage));

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("deals.title")}
				description={fillMessage(t("deals.description"), {
					count: number.format(openDeals.length),
					amount: compactMoney.format(
						openDeals.reduce((sum, deal) => sum + deal.amount, 0),
					),
				})}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv(
								"deals.csv",
								toCsv(
									activeView === "table" ? tableRows : filtered,
									dealCsvColumns(t, now),
								),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Tabs
					value={activeView}
					onValueChange={(value) =>
						navigate({
							search: (previous) => ({
								...previous,
								view: DEAL_VIEWS.find(
									(option) => option === value && option !== "board",
								),
							}),
							replace: true,
						})
					}
				>
					<TabsList>
						<TabsTrigger value="board">
							<KanbanIcon />
							{t("deals.board")}
						</TabsTrigger>
						<TabsTrigger value="table">
							<TableIcon />
							{t("deals.table")}
						</TabsTrigger>
					</TabsList>
				</Tabs>
				<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
					<div className="relative w-full sm:w-64">
						<MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("deals.searchPlaceholder")}
							aria-label={t("deals.searchPlaceholder")}
							className="ps-8"
						/>
					</div>
					<RecordFilter
						label={t("deals.owner")}
						options={owners}
						value={ownerId}
						onValueChange={setOwnerId}
					/>
				</div>
			</div>
			{activeView === "board" ? (
				<>
					{/* The board scrolls inside the page column, never the page. "relative" makes it the box of the
					    sr-only texts of the cards, so the clip of the scroll also holds them. */}
					<div className="relative flex items-start gap-4 overflow-x-auto pb-2">
						{board.columns.map((column) => (
							<BoardColumn key={column.stage} column={column} now={now} />
						))}
					</div>
					<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-muted-foreground text-sm">
						{/* The line hides while no deal was lost in the period. */}
						{board.lost.count > 0 ? (
							<p>
								{fillMessage(t("deals.lostLine"), {
									period: dayCount.format(BOARD_DAYS),
									count: number.format(board.lost.count),
									amount: compactMoney.format(board.lost.amount),
								})}{" "}
								<Link
									to="/app/deals"
									search={{ view: "table", stage: "lost" }}
									className="text-foreground underline decoration-ring underline-offset-4 hover:decoration-2"
								>
									{t("deals.viewLost")}
								</Link>
							</p>
						) : null}
						<p className="flex items-center gap-1.5">
							<FlagPennantIcon className="size-4 text-warning" />
							{fillMessage(t("deals.stalledLegend"), {
								days: dayCount.format(STALLED_AFTER_DAYS),
							})}
						</p>
					</div>
				</>
			) : (
				<>
					<Tabs
						value={activeStage ?? "all"}
						onValueChange={(value) =>
							navigate({
								search: (previous) => ({
									...previous,
									stage: DEAL_STAGES.find((option) => option === value),
								}),
								replace: true,
							})
						}
						className="max-w-full overflow-x-auto"
					>
						<TabsList>
							<TabsTrigger value="all">
								{t("deals.all")}
								<span className="text-muted-foreground tabular-nums">
									{number.format(filtered.length)}
								</span>
							</TabsTrigger>
							{tabs.map((tab) => (
								<TabsTrigger key={tab.value} value={tab.value}>
									{t(`stages.${tab.value}`)}
									<span className="text-muted-foreground tabular-nums">
										{number.format(tab.count)}
									</span>
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
					<Card>
						<CardContent>
							<DealTable
								deals={tableRows}
								variant="list"
								pageSize={20}
								searchable={false}
								noResults={t("deals.noResults")}
							/>
						</CardContent>
					</Card>
				</>
			)}
		</div>
	);
}

// Placeholder cards of one skeleton column. Fixed keys, because they never reorder.
const SKELETON_CARDS = ["1", "2", "3"];

/** Placeholder while the list loader runs: the header, the toolbar, and the board. The route sets it as pendingComponent. */
export function DealsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-64 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="flex flex-wrap justify-between gap-2">
				<Skeleton className="h-9 w-44" />
				<Skeleton className="h-9 w-80 max-w-full" />
			</div>
			<div className="flex gap-4 overflow-hidden">
				{WINNING_PATH.map((stage) => (
					<div key={stage} className="grid w-72 shrink-0 content-start gap-3">
						<Skeleton className="h-10" />
						{SKELETON_CARDS.map((card) => (
							<Skeleton key={card} className="h-44" />
						))}
					</div>
				))}
			</div>
		</div>
	);
}

/** Error state of the list and of the deal page when a loader fails. Try again runs the loader again. */
export function DealsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("deals.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
