// The housekeeping page behind login: the progress of the day, the floor and attendant filters, and the task board.
// The /app/housekeeping route renders it after its loader. The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { ATTENDANTS, type Attendant, fillMessage } from "~/features/hotel";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { housekeepingTasksQueryOptions } from "../api/housekeeping.queries";
import {
	BOARD_COLUMNS,
	tasksOfColumn,
	workloadPerAttendant,
} from "../lib/task-board";
import { TaskCard } from "./task-card";
import { WorkloadCard } from "./workload-card";

/** The floor tabs. `all` shows every floor. */
const FLOOR_TABS = ["all", "1", "2", "3"] as const;
type FloorTab = (typeof FLOOR_TABS)[number];
// The Done column shows the 5 last tasks first. By the evening it holds about 20 tasks.
const DONE_PREVIEW = 5;

/** The page. The filters change the board only; the progress card always shows the whole team. */
export function HousekeepingPage() {
	const { t, locale } = useT();
	const { data: tasks } = useSuspenseQuery(housekeepingTasksQueryOptions());
	const [floor, setFloor] = useState<FloorTab>("all");
	const [attendantId, setAttendantId] = useState<Attendant["id"] | "all">(
		"all",
	);
	const [showsAllDone, setShowsAllDone] = useState(false);
	const number = new Intl.NumberFormat(locale);
	const today = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const shown = tasks.filter(
		(task) =>
			(floor === "all" || String(task.floor) === floor) &&
			(attendantId === "all" || task.attendantId === attendantId),
	);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("housekeeping.title")}
				description={today.format(new Date())}
			/>
			<WorkloadCard workloads={workloadPerAttendant(tasks)} />
			<div className="flex flex-wrap items-center gap-2">
				<Tabs
					value={floor}
					onValueChange={(value) =>
						setFloor(FLOOR_TABS.find((option) => option === value) ?? "all")
					}
					className="max-w-full overflow-x-auto"
				>
					<TabsList aria-label={t("housekeeping.floor")}>
						{FLOOR_TABS.map((option) => (
							<TabsTrigger key={option} value={option}>
								{option === "all"
									? t("housekeeping.allFloors")
									: t(`floors.floor${option}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<Select
					value={attendantId}
					onValueChange={(value) =>
						setAttendantId(
							ATTENDANTS.find((attendant) => attendant.id === value)?.id ??
								"all",
						)
					}
				>
					<SelectTrigger
						className="w-full sm:w-48"
						aria-label={t("housekeeping.attendant")}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">
							{t("housekeeping.allAttendants")}
						</SelectItem>
						{ATTENDANTS.map((attendant) => (
							<SelectItem key={attendant.id} value={attendant.id}>
								{attendant.fullName}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 items-start @3xl/main:gap-6 gap-4">
				{BOARD_COLUMNS.map((column) => {
					const rows = tasksOfColumn(shown, column);
					const visibleRows =
						column === "done" && !showsAllDone
							? rows.slice(0, DONE_PREVIEW)
							: rows;
					return (
						<Card key={column}>
							<CardHeader>
								<CardTitle>{t(`housekeeping.statuses.${column}`)}</CardTitle>
								<CardAction>
									<Badge variant="secondary" className="tabular-nums">
										{number.format(rows.length)}
									</Badge>
								</CardAction>
							</CardHeader>
							<CardContent className="grid gap-2">
								{rows.length === 0 ? (
									<p className="py-6 text-center text-muted-foreground text-sm">
										{t(`housekeeping.empty.${column}`)}
									</p>
								) : (
									visibleRows.map((task) => (
										<TaskCard key={task.id} task={task} />
									))
								)}
								{column === "done" && rows.length > DONE_PREVIEW ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setShowsAllDone(!showsAllDone)}
									>
										{showsAllDone
											? t("housekeeping.showLess")
											: fillMessage(t("housekeeping.showAll"), {
													count: number.format(rows.length),
												})}
									</Button>
								) : null}
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}

// Placeholder columns and cards of the skeleton. Fixed keys, because they never reorder.
const SKELETON_COLUMNS = ["1", "2", "3"];
const SKELETON_CARDS = ["1", "2", "3", "4"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function HousekeepingPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-56" />
			</div>
			<Skeleton className="h-36 w-full" />
			<Skeleton className="h-9 w-80 max-w-full" />
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 items-start @3xl/main:gap-6 gap-4">
				{SKELETON_COLUMNS.map((column) => (
					<Card key={column}>
						<CardContent className="grid gap-2">
							{SKELETON_CARDS.map((card) => (
								<Skeleton key={card} className="h-24 w-full" />
							))}
						</CardContent>
					</Card>
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
