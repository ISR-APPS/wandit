// The Visits tab of the member page: every check-in on file in RecordTable, with the class, the coach, and the room.
// MemberDetailPage renders it in a Card when the user opens the tab.
import { formatRelativeTime } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { VisitRow } from "../lib/member-rows";

// Twenty rows per page, as a list page.
const VISITS_PAGE_SIZE = 20;

type MemberVisitsTableProps = {
	/** Every visit of the member, newest first. */
	visits: VisitRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

/** An open gym visit shows "Open gym" and no coach or room. */
export function MemberVisitsTable({ visits, now }: MemberVisitsTableProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const columns: RecordColumn<VisitRow>[] = [
		{
			id: "at",
			header: t("members.date"),
			sortValue: (row) => row.at,
			cell: (row) => (
				<div className="grid">
					<span className="font-medium tabular-nums">
						{dateTime.format(row.at)}
					</span>
					<span className="text-muted-foreground text-xs">
						{formatRelativeTime(row.at, now, locale)}
					</span>
				</div>
			),
		},
		{
			id: "class",
			header: t("members.class"),
			sortValue: (row) => row.className ?? "",
			cell: (row) => row.className ?? t("members.openGym"),
		},
		{
			id: "coach",
			header: t("members.coach"),
			hideable: true,
			sortValue: (row) => row.coachName ?? "",
			cell: (row) => row.coachName ?? "–",
		},
		{
			id: "studio",
			header: t("members.studio"),
			hideable: true,
			sortValue: (row) => row.studio ?? "",
			cell: (row) => row.studio ?? "–",
		},
	];
	return (
		<RecordTable
			rows={visits}
			columns={columns}
			searchText={(row) =>
				`${row.className ?? t("members.openGym")} ${row.coachName ?? ""} ${row.studio ?? ""}`
			}
			searchPlaceholder={t("members.filterVisits")}
			pageSize={VISITS_PAGE_SIZE}
			noResults={t("members.noVisitMatch")}
		/>
	);
}
