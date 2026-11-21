// The Team page: every person of the team in one table, with a text filter, three filter buttons, a column menu,
// row checkboxes, a row menu, and pages of 10. The /app/team route renders it after its loader.
// "Open" in a row menu opens the side sheet of the person with the load and the open tasks.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { projectsQueryOptions } from "~/features/projects";
import {
	CapacityMeter,
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	fillMessage,
	membersQueryOptions,
	PersonAvatar,
	tasksQueryOptions,
	toCsv,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	buildWorkload,
	LOAD_STATES,
	type LoadState,
	loadStateOf,
	type WorkloadRow,
} from "../lib/workload";
import { MemberSheet } from "./member-sheet";

/** Rows per page, as the kit user list. */
const PAGE_SIZE = 10;

// Available is good news, busy is a warning, over capacity is the tinted destructive look.
const LOAD_BADGE = {
	available: { variant: "success", className: "" },
	busy: { variant: "warning", className: "" },
	over: {
		variant: "outline",
		className: "border-destructive/25 bg-destructive/12 text-destructive",
	},
} as const satisfies Record<
	LoadState,
	{ variant: "success" | "warning" | "outline"; className: string }
>;

/** One table row: the workload of a person and the count of projects they work on. */
type TeamRow = WorkloadRow & { projectCount: number };

/** The filters narrow the rows during render. The sheet opens on the row of its "Open" item. */
export function TeamPage() {
	const { t, locale } = useT();
	const { data: members } = useSuspenseQuery(membersQueryOptions());
	const { data: tasks } = useSuspenseQuery(tasksQueryOptions());
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	const [role, setRole] = useState<string | null>(null);
	const [load, setLoad] = useState<string | null>(null);
	const [project, setProject] = useState<string | null>(null);
	const [openRow, setOpenRow] = useState<TeamRow | null>(null);
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);

	const allRows: TeamRow[] = buildWorkload(members, tasks, now).map((row) => ({
		...row,
		projectCount: projects.filter((item) =>
			item.memberIds.includes(row.member.id),
		).length,
	}));
	const rows = allRows.filter(
		(row) =>
			(role === null || row.member.role === role) &&
			(load === null || loadStateOf(row.load) === load) &&
			(project === null ||
				projects
					.find((item) => item.id === project)
					?.memberIds.includes(row.member.id) === true),
	);
	const overCount = allRows.filter((row) => row.load > 1).length;
	const roles = [...new Set(members.map((member) => member.role))].sort(
		(first, second) => first.localeCompare(second, locale),
	);

	const columns: RecordColumn<TeamRow>[] = [
		{
			id: "name",
			header: t("team.person"),
			cell: (row) => (
				<span className="flex items-center gap-3">
					<PersonAvatar name={row.member.name} className="size-8" />
					<button
						type="button"
						onClick={() => setOpenRow(row)}
						className="whitespace-nowrap font-medium hover:underline"
					>
						{row.member.name}
					</button>
				</span>
			),
			sortValue: (row) => row.member.name,
		},
		{
			id: "role",
			header: t("team.role"),
			cell: (row) => (
				<span className="whitespace-nowrap">{row.member.role}</span>
			),
			sortValue: (row) => row.member.role,
			hideable: true,
		},
		{
			id: "load",
			header: t("team.load"),
			cell: (row) => (
				<CapacityMeter
					points={row.committedPoints}
					capacity={row.member.capacity}
				/>
			),
			sortValue: (row) => row.load,
			hideable: true,
		},
		{
			id: "email",
			header: t("team.email"),
			cell: (row) => (
				<span className="whitespace-nowrap">{row.member.email}</span>
			),
			sortValue: (row) => row.member.email,
			hideable: true,
		},
		{
			id: "projects",
			header: t("team.projects"),
			cell: (row) => number.format(row.projectCount),
			sortValue: (row) => row.projectCount,
			align: "end",
			hideable: true,
		},
		{
			id: "status",
			header: t("team.status"),
			cell: (row) => {
				const state = loadStateOf(row.load);
				const look = LOAD_BADGE[state];
				return (
					<Badge variant={look.variant} className={look.className}>
						{t(`team.loadState.${state}`)}
					</Badge>
				);
			},
			sortValue: (row) => row.load,
			hideable: true,
		},
	];

	const csvColumns: CsvColumn<TeamRow>[] = [
		{ header: t("team.person"), value: (row) => row.member.name },
		{ header: t("team.role"), value: (row) => row.member.role },
		{ header: t("team.email"), value: (row) => row.member.email },
		{ header: t("team.projects"), value: (row) => String(row.projectCount) },
		{
			header: t("team.committed"),
			value: (row) => String(row.committedPoints),
		},
		{ header: t("team.capacity"), value: (row) => String(row.member.capacity) },
		{
			header: t("team.status"),
			value: (row) => t(`team.loadState.${loadStateOf(row.load)}`),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("team.title")}
				description={fillMessage(t("team.description"), {
					people: number.format(members.length),
					over: number.format(overCount),
				})}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() => downloadCsv("team.csv", toCsv(rows, csvColumns))}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<RecordTable<TeamRow>
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${row.member.name} ${row.member.role} ${row.member.email}`
				}
				searchPlaceholder={t("team.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("team.status")}
							options={LOAD_STATES.map((value) => ({
								value,
								label: t(`team.loadState.${value}`),
							}))}
							value={load}
							onValueChange={setLoad}
						/>
						<RecordFilter
							label={t("team.role")}
							options={roles.map((value) => ({ value, label: value }))}
							value={role}
							onValueChange={setRole}
						/>
						<RecordFilter
							label={t("team.project")}
							options={projects.map((item) => ({
								value: item.id,
								label: item.name,
							}))}
							value={project}
							onValueChange={setProject}
						/>
					</>
				}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem onSelect={() => setOpenRow(row)}>
							{t("table.open")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.member.email, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("team.copyEmail")}
						</DropdownMenuItem>
					</>
				)}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv("team-selected.csv", toCsv(selected, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("team.noResults")}
			/>
			<MemberSheet
				row={openRow}
				onOpenChange={(open) => {
					if (!open) {
						setOpenRow(null);
					}
				}}
			/>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function TeamPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-56 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full max-w-2xl" />
			<Skeleton className="h-130" />
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
