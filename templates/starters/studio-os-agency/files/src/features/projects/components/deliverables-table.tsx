// The Table view of a project task board: the same deliverables as the board, as sortable rows.
// ProjectDetailPage renders it in the "Table" tab with the rows after its search and its filter.
import {
	DELIVERABLE_STATUSES,
	DeliverableBadge,
	PersonAvatar,
	PRIORITIES,
	PriorityBadge,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { BoardItem } from "../lib/project-detail";

// A project has at most a few dozen deliverables: twenty rows per page, as on a list page.
const TABLE_PAGE_SIZE = 20;

/** The page searches and filters the rows, so the table has no filter field of its own. */
export function DeliverablesTable({ items }: { items: BoardItem[] }) {
	const { t } = useT();
	const { longDate } = useFormatters();
	const columns: RecordColumn<BoardItem>[] = [
		{
			id: "name",
			header: t("projectDetail.deliverable"),
			sortValue: (row) => row.name,
			cell: (row) => <span className="font-medium">{row.name}</span>,
		},
		{
			id: "owner",
			header: t("projectDetail.owner"),
			sortValue: (row) => row.ownerName,
			hideable: true,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<PersonAvatar name={row.ownerName} className="size-7" />
					{row.ownerName}
				</span>
			),
		},
		{
			id: "status",
			header: t("projects.status"),
			// The index keeps the order of the work, not the alphabet of the codes.
			sortValue: (row) => DELIVERABLE_STATUSES.indexOf(row.status),
			hideable: true,
			cell: (row) => <DeliverableBadge status={row.status} />,
		},
		{
			id: "priority",
			header: t("projectDetail.priority"),
			// The index sorts high, medium, low. A row with no priority sorts after low.
			sortValue: (row) =>
				row.priority === null
					? PRIORITIES.length
					: PRIORITIES.indexOf(row.priority),
			hideable: true,
			cell: (row) =>
				row.priority === null ? (
					<span className="text-muted-foreground">–</span>
				) : (
					<PriorityBadge priority={row.priority} />
				),
		},
		{
			id: "due",
			header: t("projectDetail.due"),
			sortValue: (row) => row.dueDay,
			hideable: true,
			cell: (row) => (
				<span className="tabular-nums">{longDate(row.dueDay)}</span>
			),
		},
	];
	return (
		<Card>
			<CardContent>
				<RecordTable
					rows={items}
					columns={columns}
					pageSize={TABLE_PAGE_SIZE}
					noResults={t("projectDetail.noResults")}
				/>
			</CardContent>
		</Card>
	);
}
