// The Team page: the workload of each person as a chart, then a table with the points, the open and late work, and the output.
// The chart owns the load bars. The table adds the counts that the chart does not show.
// The /app/team route renders it after its loader. The route also uses the skeleton and the error below.
// A click on a name opens the side panel of that person.
import { WarningIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CURRENT_MEMBER_ID,
	fillMessage,
	membersQueryOptions,
	PersonAvatar,
	tasksQueryOptions,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { buildWorkload, OUTPUT_DAYS, type WorkloadRow } from "../lib/workload";
import { MemberSheet } from "./member-sheet";
import { WorkloadChartCard } from "./workload-chart-card";

/** The chart and the table read the same rows, so their numbers agree. */
export function TeamPage() {
	const { t, locale } = useT();
	const { data: members } = useSuspenseQuery(membersQueryOptions());
	const { data: tasks } = useSuspenseQuery(tasksQueryOptions());
	const [openRowId, setOpenRowId] = useState<string | null>(null);
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const rows = buildWorkload(members, tasks, now);
	const overCount = rows.filter((row) => row.load > 1).length;
	const openRow = rows.find((row) => row.id === openRowId) ?? null;

	const columns: DataTableColumn<WorkloadRow>[] = [
		{
			id: "person",
			header: t("team.person"),
			sortValue: (row) => row.member.name,
			cell: (row) => (
				<button
					type="button"
					onClick={() => setOpenRowId(row.id)}
					className="flex min-w-48 items-center gap-3 rounded-control text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					<PersonAvatar name={row.member.name} />
					<span className="grid gap-0.5">
						<span className="flex items-center gap-2 font-medium hover:underline">
							<bdi>{row.member.name}</bdi>
							{row.id === CURRENT_MEMBER_ID ? (
								<Badge variant="secondary">{t("team.you")}</Badge>
							) : null}
						</span>
						<span className="text-muted-foreground text-xs">
							{row.member.role}
						</span>
					</span>
				</button>
			),
		},
		{
			id: "committed",
			header: t("team.committed"),
			align: "end",
			sortValue: (row) => row.load,
			cell: (row) => (
				<span className="whitespace-nowrap">
					{/* Over capacity takes the destructive color, as the bar label of the chart does. */}
					<span
						className={cn("font-medium", row.load > 1 && "text-destructive")}
					>
						{number.format(row.committedPoints)}
					</span>
					<span className="text-muted-foreground">{` / ${number.format(row.member.capacity)}`}</span>
				</span>
			),
		},
		{
			id: "open",
			header: t("team.open"),
			align: "end",
			sortValue: (row) => row.openTasks.length,
			cell: (row) => number.format(row.openTasks.length),
		},
		{
			id: "overdue",
			header: t("team.overdue"),
			align: "end",
			sortValue: (row) => row.overdueCount,
			cell: (row) =>
				row.overdueCount > 0 ? (
					<span className="inline-flex items-center gap-1 font-medium text-destructive">
						<WarningIcon className="size-3.5" />
						{number.format(row.overdueCount)}
					</span>
				) : (
					<span className="text-muted-foreground">{number.format(0)}</span>
				),
		},
		{
			id: "done",
			header: fillMessage(t("team.doneShort"), {
				days: number.format(OUTPUT_DAYS),
			}),
			align: "end",
			sortValue: (row) => row.doneCount,
			cell: (row) => number.format(row.doneCount),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("team.title")}
				description={fillMessage(t("team.description"), {
					people: number.format(members.length),
					over: number.format(overCount),
				})}
			/>
			<div className="grid @5xl/main:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] grid-cols-1 @3xl/main:gap-6 gap-4">
				<WorkloadChartCard rows={rows} />
				<Card>
					<CardContent>
						<DataTable
							rows={rows}
							columns={columns}
							searchText={(row) => `${row.member.name} ${row.member.role}`}
							noResults={t("team.noResults")}
						/>
					</CardContent>
				</Card>
			</div>
			<MemberSheet row={openRow} onOpenChange={() => setOpenRowId(null)} />
		</div>
	);
}

/** Placeholder while the loader runs: the header, the chart, and the table. */
export function TeamPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-28" />
				<Skeleton className="h-4 w-64 max-w-full" />
			</div>
			<div className="grid @5xl/main:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] grid-cols-1 gap-4">
				<Skeleton className="h-[30rem] rounded-surface" />
				<Skeleton className="h-[30rem] rounded-surface" />
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function TeamPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("team.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
