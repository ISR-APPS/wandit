// The member table: RecordTable with the member columns, a row menu, row selection, and the export of the selected rows.
// The members page and the members card of the home render it. They filter the rows first.
// It follows the table of the kit system: checkbox, two-line name, sortable heads, status badge, row menu.
import { DownloadSimpleIcon, WarningIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	copyToClipboard,
	downloadCsv,
	formatRelativeTime,
	MEMBER_STATUSES,
	MemberAvatar,
	MemberStatusBadge,
	toCsv,
} from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import { memberCsvColumns } from "../lib/member-csv";
import type { MemberRow } from "../lib/member-rows";

type MemberTableProps = {
	/** The members to list, after the filters of the page. */
	members: MemberRow[];
	/** "home" puts the email under the name. "list" gives the email and the join day their own columns. */
	variant: "home" | "list";
	/** Rows per page: 8 on the home card, 10 on the members page. */
	pageSize: number;
	/** Filter buttons after the filter field. */
	toolbar?: ReactNode;
	/** Text when no row matches. */
	noResults: string;
};

/** The name links to the member page. An at-risk member shows a warning mark beside the last visit. */
export function MemberTable({
	members,
	variant,
	pageSize,
	toolbar,
	noResults,
}: MemberTableProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const now = Date.now();

	const nameColumn: RecordColumn<MemberRow> = {
		id: "name",
		header: t("members.name"),
		sortValue: (row) => row.fullName,
		cell: (row) => (
			<div className="flex items-center gap-3">
				<MemberAvatar
					name={row.fullName}
					className={variant === "list" ? "size-8" : "size-9"}
				/>
				{/* justify-items-start: each line is as wide as its text. */}
				<div className="grid min-w-0 justify-items-start">
					<Link
						to="/app/members/$memberId"
						params={{ memberId: row.id }}
						className="font-medium hover:underline"
					>
						{row.fullName}
					</Link>
					{variant === "home" ? (
						<span className="text-muted-foreground text-xs">{row.email}</span>
					) : null}
				</div>
			</div>
		),
	};
	const listColumns: RecordColumn<MemberRow>[] =
		variant === "list"
			? [
					{
						id: "email",
						header: t("members.email"),
						hideable: true,
						sortValue: (row) => row.email,
						cell: (row) => row.email,
					},
					{
						id: "joined",
						header: t("members.joined"),
						hideable: true,
						sortValue: (row) => row.joinedAt,
						cell: (row) => (
							<span className="tabular-nums">{date.format(row.joinedAt)}</span>
						),
					},
				]
			: [];

	const columns: RecordColumn<MemberRow>[] = [
		nameColumn,
		{
			id: "plan",
			header: t("members.plan"),
			hideable: true,
			sortValue: (row) => row.planName,
			cell: (row) => row.planName,
		},
		...listColumns,
		{
			id: "lastVisit",
			header: t("members.lastVisit"),
			hideable: true,
			// A member who never came sorts before the oldest visit.
			sortValue: (row) => row.lastVisitAt ?? 0,
			cell: (row) =>
				row.lastVisitAt === null ? (
					<span className="text-muted-foreground">{t("members.never")}</span>
				) : row.isAtRisk ? (
					<span className="inline-flex items-center gap-1 font-medium text-warning">
						<WarningIcon className="size-3.5" />
						<span className="sr-only">{t("members.atRisk")}</span>
						{formatRelativeTime(row.lastVisitAt, now, locale)}
					</span>
				) : (
					<span className="text-muted-foreground">
						{formatRelativeTime(row.lastVisitAt, now, locale)}
					</span>
				),
		},
		{
			id: "visits",
			header: t("members.visitsWindow"),
			hideable: true,
			align: "end",
			sortValue: (row) => row.visitsInWindow,
			cell: (row) => (
				<span className="font-medium">{number.format(row.visitsInWindow)}</span>
			),
		},
		{
			id: "status",
			header: t("members.status"),
			sortValue: (row) => MEMBER_STATUSES.indexOf(row.status),
			cell: (row) => <MemberStatusBadge status={row.status} />,
		},
	];

	return (
		<RecordTable
			rows={members}
			columns={columns}
			searchText={(row) => `${row.fullName} ${row.email} ${row.planName}`}
			searchPlaceholder={t("members.filterPlaceholder")}
			toolbar={toolbar}
			pageSize={pageSize}
			noResults={noResults}
			selectable
			bulkActions={(selectedRows) => (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() =>
						downloadCsv(
							"members-selected.csv",
							toCsv(selectedRows, memberCsvColumns(t)),
						)
					}
				>
					<DownloadSimpleIcon />
					{t("table.exportSelected")}
				</Button>
			)}
			rowMenu={(row) => (
				<>
					<DropdownMenuItem asChild>
						<Link to="/app/members/$memberId" params={{ memberId: row.id }}>
							{t("members.openMember")}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							copyToClipboard(row.email, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						{t("members.copyEmail")}
					</DropdownMenuItem>
				</>
			)}
		/>
	);
}
