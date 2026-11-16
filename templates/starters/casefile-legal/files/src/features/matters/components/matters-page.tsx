// The matter list behind login: the page header, the stage tabs, the area filter, and the searchable table.
// The /app/matters route renders it after its loader. The route also uses the skeleton and the error below.
// The stage tab and the area live in the URL (?stage=drafting&area=family), so the board can link to one stage.
import { FlagPennantIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	Link,
	useNavigate,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	calendarDaysUntil,
	DEADLINE_SOON_DAYS,
	fillMessage,
	formatRelativeTime,
	MATTER_STAGES,
	MatterStageBadge,
	moneyFormat,
	PersonAvatar,
	PRACTICE_AREAS,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
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
import { mattersQueryOptions } from "../api/matters.queries";
import type { MatterSummary } from "../lib/matter-joins";

// The value of the "All areas" choice. A Select item cannot have an empty value.
const ALL_AREAS = "all";

/** The list page. The area filter and the stage tab filter the rows; then DataTable searches, sorts, and pages them. */
export function MattersPage() {
	const { t, locale } = useT();
	const { data: matters } = useSuspenseQuery(mattersQueryOptions());
	const search = useSearch({ from: "/app/matters/" });
	const navigate = useNavigate({ from: "/app/matters/" });
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const now = Date.now();

	const inArea = search.area
		? matters.filter((matter) => matter.area === search.area)
		: matters;
	// A tab shows only for a stage that has rows in the chosen area. Its count is the row count of the tab.
	const tabs = MATTER_STAGES.map((stage) => ({
		stage,
		count: inArea.filter((matter) => matter.stage === stage).length,
	})).filter((tab) => tab.count > 0);
	// The area can empty the chosen tab. Its tab then disappears, so the list shows all rows of the area.
	const activeStage = tabs.some((tab) => tab.stage === search.stage)
		? search.stage
		: undefined;
	const rows = activeStage
		? inArea.filter((matter) => matter.stage === activeStage)
		: inArea;

	// The deadline column and the phone line of the matter cell show the same text.
	const deadlineText = (dueAt: string) =>
		calendarDaysUntil(dueAt, now) <= DEADLINE_SOON_DAYS ? (
			<span className="flex items-center gap-1.5 whitespace-nowrap font-medium text-warning">
				<FlagPennantIcon className="size-3.5" />
				{formatRelativeTime(dueAt, now, locale)}
			</span>
		) : (
			<span className="whitespace-nowrap">
				{formatRelativeTime(dueAt, now, locale)}
			</span>
		);

	const columns: DataTableColumn<MatterSummary>[] = [
		{
			id: "matter",
			header: t("matters.matter"),
			sortValue: (row) => row.name,
			// justify-items-start: each line is as wide as its text, so dir="auto" text sits at the start side.
			// The stage, the area, and the client sit in this cell, so the table fits 1024 px with the sidebar.
			// The stage tabs filter by stage, so the stage needs no column of its own.
			cell: (row) => (
				<div className="grid w-64 justify-items-start gap-1">
					<Link
						to="/app/matters/$matterId"
						params={{ matterId: row.id }}
						className="max-w-full truncate font-medium hover:underline"
						dir="auto"
					>
						{row.name}
					</Link>
					<span className="flex max-w-full items-center gap-2 text-muted-foreground text-xs">
						<MatterStageBadge stage={row.stage} />
						<span className="truncate">
							<span className="font-numeric tabular-nums">{row.number}</span>
							{" · "}
							{t(`areas.${row.area}`)}
						</span>
					</span>
					<span
						className="max-w-full truncate text-muted-foreground text-xs"
						dir="auto"
					>
						{row.clientName}
					</span>
					{/* On a phone the deadline and money columns are off screen, so the key values also show here. */}
					{row.nextDeadline || row.ledger.outstanding > 0 ? (
						<span className="flex @2xl/main:hidden max-w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs">
							{row.nextDeadline ? deadlineText(row.nextDeadline.dueAt) : null}
							{row.ledger.outstanding > 0 ? (
								<span
									className={cn(
										"font-medium tabular-nums",
										row.ledger.overdue > 0 && "text-destructive",
									)}
								>
									{fillMessage(t("matters.outstandingAmount"), {
										amount: money.format(row.ledger.outstanding),
									})}
								</span>
							) : null}
						</span>
					) : null}
				</div>
			),
		},
		{
			id: "lead",
			header: t("matters.leadShort"),
			sortValue: (row) => row.leadName,
			// Initials only below the 4xl container width, so the table fits 1024 px with the sidebar.
			// Wider, the full name shows beside the initials. Screen readers always get the name.
			cell: (row) => (
				<span
					title={row.leadName}
					className="inline-flex items-center gap-2 whitespace-nowrap"
				>
					<PersonAvatar name={row.leadName} />
					<span className="sr-only @4xl/main:not-sr-only">{row.leadName}</span>
				</span>
			),
		},
		{
			id: "deadline",
			header: t("matters.deadline"),
			// No deadline sorts last in the ascending order.
			sortValue: (row) =>
				row.nextDeadline
					? Date.parse(row.nextDeadline.dueAt)
					: Number.MAX_SAFE_INTEGER,
			cell: (row) =>
				row.nextDeadline ? (
					deadlineText(row.nextDeadline.dueAt)
				) : (
					<span className="text-muted-foreground">{t("matters.none")}</span>
				),
		},
		{
			id: "unbilled",
			header: t("matters.unbilled"),
			align: "end",
			sortValue: (row) => row.ledger.unbilled,
			// A zero amount is muted, so the rows with money stand out.
			cell: (row) => (
				<span
					className={cn(row.ledger.unbilled === 0 && "text-muted-foreground")}
				>
					{money.format(row.ledger.unbilled)}
				</span>
			),
		},
		{
			id: "outstanding",
			header: t("matters.outstanding"),
			align: "end",
			sortValue: (row) => row.ledger.outstanding,
			cell: (row) =>
				row.ledger.overdue > 0 ? (
					<span className="font-medium text-destructive">
						{money.format(row.ledger.outstanding)}
					</span>
				) : (
					<span
						className={cn(
							row.ledger.outstanding === 0 && "text-muted-foreground",
						)}
					>
						{money.format(row.ledger.outstanding)}
					</span>
				),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("matters.title")}
				description={t("matters.description")}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.name} ${row.number} ${row.clientName} ${row.leadName} ${row.opposingParty ?? ""}`
						}
						noResults={t("matters.noResults")}
						toolbar={
							<>
								<Select
									value={search.area ?? ALL_AREAS}
									onValueChange={(value) =>
										navigate({
											search: (previous) => ({
												...previous,
												area: PRACTICE_AREAS.find((area) => area === value),
											}),
										})
									}
								>
									<SelectTrigger
										aria-label={t("matters.areaFilter")}
										className="w-full sm:w-48"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_AREAS}>
											{t("matters.allAreas")}
										</SelectItem>
										{PRACTICE_AREAS.map((area) => (
											<SelectItem key={area} value={area}>
												{t(`areas.${area}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Tabs
									value={activeStage ?? "all"}
									onValueChange={(value) =>
										navigate({
											search: (previous) => ({
												...previous,
												stage: MATTER_STAGES.find((stage) => stage === value),
											}),
										})
									}
									className="max-w-full overflow-x-auto"
								>
									<TabsList>
										<TabsTrigger value="all">
											{t("matters.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(inArea.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.stage} value={tab.stage}>
												{t(`stages.${tab.stage}`)}
												<span className="text-muted-foreground tabular-nums">
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
export function MattersPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xl" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the matter pages when a loader fails. Try again runs the loader again. */
export function MattersPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("matters.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
