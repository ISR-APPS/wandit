// The housekeeping page behind login: the room board of today, or the same tasks as a table.
// The /app/housekeeping route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the kanban page of the kit: the team avatars and an outline action in the header,
// a Board | Table switch with a search and the filters, then the columns Dirty, Cleaning, Inspection, Ready.
import {
	DownloadSimpleIcon,
	KanbanIcon,
	TableIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ATTENDANTS,
	downloadCsv,
	fillMessage,
	initialsOf,
	toCsv,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { housekeepingTasksQueryOptions } from "../api/housekeeping.queries";
import {
	BOARD_COLUMNS,
	columnOf,
	PRIORITY_BADGE,
	priorityOf,
	TASK_PRIORITIES,
	type TaskRow,
	tasksOfColumn,
} from "../lib/task-board";
import { BoardColumn } from "./board-column";

/** The floors of the hotel, as the values of the floor filter. Each one has a `floors.floor<n>` label. */
const FLOORS = ["1", "2", "3"] as const;

/** The two views of the same tasks. */
const VIEWS = ["board", "table"] as const;
type View = (typeof VIEWS)[number];

/** The search and the two filters cut the tasks of both views. */
export function HousekeepingPage() {
	const { t, locale } = useT();
	const { data: tasks } = useSuspenseQuery(housekeepingTasksQueryOptions());
	const [view, setView] = useState<View>("board");
	const [query, setQuery] = useState("");
	const [attendantId, setAttendantId] = useState<string | null>(null);
	const [floor, setFloor] = useState<string | null>(null);
	const now = Date.now();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const needle = query.trim().toLocaleLowerCase(locale);
	const shown = tasks.filter(
		(task) =>
			(attendantId === null || task.attendantId === attendantId) &&
			(floor === null || String(task.floor) === floor) &&
			`${task.roomNumber} ${t(`housekeeping.kinds.${task.kind}`)} ${task.attendantName}`
				.toLocaleLowerCase(locale)
				.includes(needle),
	);
	const readyCount = tasks.filter(
		(task) => columnOf(task, now) === "ready",
	).length;

	const columns: RecordColumn<TaskRow>[] = [
		{
			id: "room",
			header: t("housekeeping.roomColumn"),
			sortValue: (row) => Number(row.roomNumber),
			cell: (row) => (
				<div className="grid">
					<span className="font-medium tabular-nums">{row.roomNumber}</span>
					<span className="text-muted-foreground text-xs">
						{t(`roomTypes.${row.roomType}`)}
					</span>
				</div>
			),
		},
		{
			id: "task",
			header: t("housekeeping.task"),
			sortValue: (row) => row.kind,
			cell: (row) => t(`housekeeping.kinds.${row.kind}`),
		},
		{
			id: "attendant",
			header: t("housekeeping.attendant"),
			sortValue: (row) => row.attendantName,
			hideable: true,
			cell: (row) => row.attendantName,
		},
		{
			id: "start",
			header: t("housekeeping.start"),
			sortValue: (row) => row.scheduledAt ?? "",
			hideable: true,
			cell: (row) => (
				<span className="tabular-nums">
					{row.scheduledAt ? time.format(new Date(row.scheduledAt)) : "–"}
				</span>
			),
		},
		{
			id: "priority",
			header: t("housekeeping.priority"),
			sortValue: (row) => TASK_PRIORITIES.indexOf(priorityOf(row)),
			hideable: true,
			cell: (row) => (
				<Badge variant="outline" className={PRIORITY_BADGE[priorityOf(row)]}>
					{t(`housekeeping.priorities.${priorityOf(row)}`)}
				</Badge>
			),
		},
		{
			id: "state",
			header: t("housekeeping.state"),
			align: "end",
			sortValue: (row) => BOARD_COLUMNS.indexOf(columnOf(row, now)),
			cell: (row) => t(`housekeeping.columns.${columnOf(row, now)}`),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("housekeeping.title")}
				description={fillMessage(t("housekeeping.description"), {
					ready: new Intl.NumberFormat(locale).format(readyCount),
					total: new Intl.NumberFormat(locale).format(tasks.length),
				})}
				actions={
					<>
						{/* The team of today. The names are in the attendant filter and on each card. */}
						{/* The opaque card base stops the next avatar from showing through the initials.
						    36 px with a 4 px overlap keeps the wide initials clear of the next avatar. */}
						<div aria-hidden="true" className="flex -space-x-1">
							{ATTENDANTS.map((attendant) => (
								<Avatar
									key={attendant.id}
									className="size-9 bg-card ring-2 ring-background"
								>
									<AvatarFallback className="bg-muted text-xs">
										{initialsOf(attendant.fullName)}
									</AvatarFallback>
								</Avatar>
							))}
						</div>
						<Button
							type="button"
							variant="outline"
							aria-label={t("common.exportCsv")}
							onClick={() =>
								downloadCsv(
									"housekeeping.csv",
									toCsv(shown, [
										{
											header: t("housekeeping.roomColumn"),
											value: (row) => row.roomNumber,
										},
										{
											header: t("housekeeping.task"),
											value: (row) => t(`housekeeping.kinds.${row.kind}`),
										},
										{
											header: t("housekeeping.attendant"),
											value: (row) => row.attendantName,
										},
										{
											header: t("housekeeping.start"),
											value: (row) =>
												row.scheduledAt
													? time.format(new Date(row.scheduledAt))
													: "",
										},
										{
											header: t("housekeeping.state"),
											value: (row) =>
												t(`housekeeping.columns.${columnOf(row, now)}`),
										},
									]),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</>
				}
			/>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Tabs
					value={view}
					onValueChange={(value) =>
						setView(VIEWS.find((option) => option === value) ?? "board")
					}
				>
					<TabsList>
						<TabsTrigger value="board">
							<KanbanIcon />
							{t("housekeeping.board")}
						</TabsTrigger>
						<TabsTrigger value="table">
							<TableIcon />
							{t("housekeeping.table")}
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
							placeholder={t("housekeeping.search")}
							aria-label={t("housekeeping.search")}
							className="ps-8"
						/>
					</div>
					<RecordFilter
						label={t("housekeeping.attendant")}
						options={ATTENDANTS.map((attendant) => ({
							value: attendant.id,
							label: attendant.fullName,
						}))}
						value={attendantId}
						onValueChange={setAttendantId}
					/>
					<RecordFilter
						label={t("housekeeping.floor")}
						options={FLOORS.map((value) => ({
							value,
							label: t(`floors.floor${value}`),
						}))}
						value={floor}
						onValueChange={setFloor}
					/>
				</div>
			</div>
			{view === "board" ? (
				// The board scrolls inside the page column, never the page.
				// "relative" keeps the absolute sr-only labels of the cards inside the scroll box.
				<div className="relative flex items-start gap-4 overflow-x-auto pb-2">
					{BOARD_COLUMNS.map((column) => (
						<BoardColumn
							key={column}
							column={column}
							tasks={tasksOfColumn(shown, column, now)}
							now={now}
						/>
					))}
				</div>
			) : (
				<Card>
					<CardContent>
						<RecordTable
							rows={shown}
							columns={columns}
							pageSize={20}
							noResults={t("housekeeping.noResults")}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// Placeholder cards of one skeleton column. Fixed keys, because they never reorder.
const SKELETON_CARDS = ["1", "2", "3"];

/** Placeholder while the loader runs: the header, the toolbar, and the board. The route sets it as pendingComponent. */
export function HousekeepingPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-44" />
					<Skeleton className="h-4 w-64 max-w-full" />
				</div>
				<Skeleton className="h-9 w-48" />
			</div>
			<div className="flex flex-wrap justify-between gap-2">
				<Skeleton className="h-9 w-44" />
				<Skeleton className="h-9 w-96 max-w-full" />
			</div>
			<div className="flex gap-4 overflow-hidden">
				{BOARD_COLUMNS.map((column) => (
					<div
						key={column}
						className="grid min-w-64 flex-1 basis-0 content-start gap-3"
					>
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

/** Error state of the page when the loader fails. Try again runs the loader again. */
export function HousekeepingPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("housekeeping.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
