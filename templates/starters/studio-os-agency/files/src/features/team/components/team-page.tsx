// The Team page behind login, on the anatomy of the kit users page plus a capacity column:
// a header with the period and one action, a table toolbar (filter field, Role and Load filters, columns menu),
// the table, and the pages.
// The /app/team route renders it after its loader, and also uses the skeleton and the error below.
// The period lives in the URL (?days=). A name or the row menu opens the member sheet.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { type ComponentProps, useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	fillMessage,
	PageError,
	PeriodSelect,
	PersonAvatar,
	toCsv,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { Progress } from "~/shared/ui/progress";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { teamLoadQueryOptions } from "../api/team.queries";
import type { MemberLoad } from "../lib/team-load";
import { MemberSheet } from "./member-sheet";

const route = getRouteApi("/app/team");

// A list page shows ten rows per page, as the kit users page does.
const TEAM_PAGE_SIZE = 10;
// Above 100 % of the contract hours a person works overtime. From 80 % the person has little room left.
const BUSY_SHARE = 0.8;

/** The load of a person, from the billable share of the contract hours. */
const LOADS = ["over", "busy", "available"] as const;

/** One load. Its label is `team.loads.<load>`. */
type Load = (typeof LOADS)[number];

/** The badge of each load. The word always shows. */
const LOAD_BADGE = {
	over: "destructive",
	busy: "warning",
	available: "success",
} satisfies Record<Load, ComponentProps<typeof Badge>["variant"]>;

/** "over" above 100 % utilization, "busy" from 80 %, else "available". */
function loadOf(member: MemberLoad): Load {
	// The table shows a whole percent, so 100.4 % reads "100%" and is not over capacity yet.
	if (Math.round(member.utilization * 100) > 100) {
		return "over";
	}
	return member.utilization >= BUSY_SHARE ? "busy" : "available";
}

/** The list page. The two filters cut the rows; then RecordTable searches, sorts, selects, and pages them. */
export function TeamPage() {
	const { t, locale } = useT();
	const { hours, percent } = useFormatters();
	const { days } = route.useSearch();
	const navigate = route.useNavigate();
	const { data: team } = useSuspenseQuery(teamLoadQueryOptions(days));
	const [role, setRole] = useState<string | null>(null);
	const [load, setLoad] = useState<string | null>(null);
	// The sheet keeps the last member while it slides out, so the panel never closes empty.
	const [openId, setOpenId] = useState<string | null>(null);
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	const rows = team.filter(
		(member) =>
			(role === null || member.role === role) &&
			(load === null || loadOf(member) === load),
	);
	const roleOptions = [...new Set(team.map((member) => member.role))].map(
		(value) => ({ value, label: t(`codes.roles.${value}`) }),
	);

	function openMember(memberId: string) {
		setOpenId(memberId);
		setIsSheetOpen(true);
	}

	const csvColumns: CsvColumn<MemberLoad>[] = [
		{ header: t("team.person"), value: (row) => row.name },
		{ header: t("team.role"), value: (row) => t(`codes.roles.${row.role}`) },
		{ header: t("team.weekly"), value: (row) => String(row.weeklyCapacity) },
		{ header: t("team.billable"), value: (row) => String(row.billable) },
		{ header: t("team.studio"), value: (row) => String(row.studio) },
		{
			header: t("team.utilization"),
			value: (row) => String(Math.round(row.utilization * 100)),
		},
	];

	const columns: RecordColumn<MemberLoad>[] = [
		{
			id: "name",
			header: t("team.person"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<button
					type="button"
					onClick={() => openMember(row.id)}
					className="flex items-center gap-3 text-start font-medium hover:underline"
				>
					<PersonAvatar name={row.name} className="size-8" />
					{row.name}
				</button>
			),
		},
		{
			id: "role",
			header: t("team.role"),
			sortValue: (row) => t(`codes.roles.${row.role}`),
			hideable: true,
			cell: (row) => t(`codes.roles.${row.role}`),
		},
		{
			id: "weekly",
			header: t("team.weekly"),
			sortValue: (row) => row.weeklyCapacity,
			align: "end",
			hideable: true,
			cell: (row) => hours(row.weeklyCapacity),
		},
		{
			id: "billable",
			header: t("team.billable"),
			sortValue: (row) => row.billable,
			align: "end",
			hideable: true,
			cell: (row) => hours(row.billable),
		},
		{
			id: "studio",
			header: t("team.studio"),
			sortValue: (row) => row.studio,
			align: "end",
			hideable: true,
			cell: (row) => hours(row.studio),
		},
		{
			id: "capacity",
			header: t("team.capacity"),
			sortValue: (row) => row.utilization,
			hideable: true,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<Progress
						value={row.utilization * 100}
						className="h-1.5 w-24"
						aria-label={t("team.capacity")}
					/>
					<span className="w-10 text-end text-muted-foreground text-xs tabular-nums">
						{percent(row.utilization)}
					</span>
				</span>
			),
		},
		{
			id: "load",
			header: t("team.load"),
			sortValue: (row) => row.utilization,
			hideable: true,
			cell: (row) => {
				const value = loadOf(row);
				return (
					<Badge variant={LOAD_BADGE[value]}>{t(`team.loads.${value}`)}</Badge>
				);
			},
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("team.title")}
				description={fillMessage(t("team.description"), {
					days: new Intl.NumberFormat(locale).format(days),
				})}
				actions={
					<>
						<PeriodSelect
							days={days}
							onDaysChange={(next) => navigate({ search: { days: next } })}
						/>
						<Button
							onClick={() => downloadCsv("team.csv", toCsv(rows, csvColumns))}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("team.export")}</span>
						</Button>
					</>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) => `${row.name} ${t(`codes.roles.${row.role}`)}`}
				searchPlaceholder={t("team.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("team.role")}
							options={roleOptions}
							value={role}
							onValueChange={setRole}
						/>
						<RecordFilter
							label={t("team.load")}
							options={LOADS.map((value) => ({
								value,
								label: t(`team.loads.${value}`),
							}))}
							value={load}
							onValueChange={setLoad}
						/>
					</>
				}
				selectable
				bulkActions={(selected) => (
					<Button
						variant="outline"
						size="sm"
						onClick={() => downloadCsv("team.csv", toCsv(selected, csvColumns))}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem onSelect={() => openMember(row.id)}>
							{t("table.open")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.id, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("table.copyId")}
						</DropdownMenuItem>
					</>
				)}
				pageSize={TEAM_PAGE_SIZE}
				noResults={t("team.noResults")}
			/>
			<MemberSheet
				member={team.find((member) => member.id === openId) ?? null}
				open={isSheetOpen}
				days={days}
				onOpenChange={setIsSheetOpen}
			/>
		</div>
	);
}

/** Placeholder while the loader runs: the header, the toolbar, and the table. */
export function TeamPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-72" />
				</div>
				<Skeleton className="h-9 w-64" />
			</div>
			<Skeleton className="h-9 w-full max-w-xl" />
			<Skeleton className="h-96 rounded-surface" />
		</div>
	);
}

/** Error state of the Team page when the loader fails. Try again runs the loader again. */
export function TeamPageError() {
	const { t } = useT();
	return <PageError message={t("team.loadError")} />;
}
