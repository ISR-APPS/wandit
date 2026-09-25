/**
 * The rows grid of the Cloud tab: one table page with sort headers and page
 * controls, or one SQL result without them. Pure presentation: the caller
 * owns the page, the sort, and the query. Rendered by database-panel.tsx
 * and sql-editor.tsx; builds on the Table of @wandit/ui.
 */

import type { CloudRowsQuery, SqlRow } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { cn } from "@wandit/ui/lib/utils";
import {
	ArrowDown,
	ArrowUp,
	ChevronLeft,
	ChevronRight,
	Rows3,
} from "lucide-react";

import { formatNumber, useTranslation } from "@/lib/i18n";
import { CodeMessage } from "../code/code-viewer";

/** Order of a sorted column; the rows route reads it as `dir`. */
export type SortDirection = CloudRowsQuery["dir"];

/** Props of RowsGrid. `paging` and `sort` are for a table page; a SQL result omits both. */
export type RowsGridProps = {
	/** Column names in display order: the table columns, or the keys of the first SQL row. */
	columns: string[];
	/** Rows of the page or of the SQL result; undefined while the first page loads. */
	rows: SqlRow[] | undefined;
	/** Shown when `rows` is empty. */
	emptyText: string;
	/** True while the next page or sort loads. The old page stays on screen, dimmed. */
	isStale?: boolean;
	/** Page controls of a table. A SQL result has no pages and omits it. */
	paging?: {
		/** Page on screen, from 1. */
		page: number;
		pageSize: number;
		/** Exact row count of the table, from the rows answer. */
		total: number;
		onPageChange: (page: number) => void;
	};
	/** Sort headers of a table. A SQL result keeps the order of its query and omits it. */
	sort?: {
		/** Column the server orders by. */
		column: string;
		direction: SortDirection;
		onSortChange: (column: string, direction: SortDirection) => void;
	};
};

/** `aria-sort` value of the sorted column header, per direction. */
const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

/** Bar widths (percent) of the first-load skeleton, fixed so each render matches. */
const SKELETON_BARS = [70, 45, 85, 60, 75, 50, 65, 40];

/**
 * Pure presentation: the caller owns the rows, the page, and the sort.
 * `rows: undefined` shows the skeleton; an empty list shows `emptyText`.
 */
export function RowsGrid({
	columns,
	rows,
	emptyText,
	isStale = false,
	paging,
	sort,
}: RowsGridProps) {
	const { t, locale } = useTranslation();

	if (rows === undefined) {
		return <RowsGridSkeleton />;
	}

	// A header click on the sorted column flips it; any other column starts ascending.
	function sortBy(column: string) {
		if (!sort) return;
		const direction =
			sort.column === column && sort.direction === "asc" ? "desc" : "asc";
		sort.onSortChange(column, direction);
	}

	const pageCount = paging
		? Math.max(1, Math.ceil(paging.total / paging.pageSize))
		: 1;

	return (
		<div className="flex min-w-0 flex-col gap-3">
			{rows.length === 0 ? (
				<CodeMessage icon={Rows3} text={emptyText} />
			) : (
				// The Table wraps itself in `overflow-x-auto`: a generated table can be wider than the panel.
				<div
					aria-busy={isStale}
					className={cn(
						"rounded-xl border transition-opacity",
						isStale && "opacity-60",
					)}
				>
					<Table>
						<TableHeader>
							<TableRow>
								{columns.map((column) => {
									const sortedDirection =
										sort?.column === column ? sort.direction : undefined;
									const SortIcon =
										sortedDirection === "desc" ? ArrowDown : ArrowUp;
									return (
										<TableHead
											key={column}
											dir="ltr"
											aria-sort={
												sortedDirection ? ARIA_SORT[sortedDirection] : undefined
											}
										>
											{sort ? (
												<button
													type="button"
													onClick={() => sortBy(column)}
													className="inline-flex items-center gap-1 rounded-sm font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
												>
													{column}
													{sortedDirection ? (
														<SortIcon className="size-3.5" />
													) : null}
												</button>
											) : (
												<span className="font-mono text-xs">{column}</span>
											)}
										</TableHead>
									);
								})}
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row, index) => (
								// Rows carry no id; a page replaces the whole list.
								// biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id
								<TableRow key={index}>
									{columns.map((column) => (
										<TableCell
											key={column}
											dir="ltr"
											className="max-w-80 truncate font-mono text-xs"
										>
											<CellValue
												value={row[column] ?? null}
												nullLabel={t("workspace.cloud.database.rows.null")}
											/>
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
			{paging ? (
				<div className="flex items-center justify-between gap-3 text-muted-foreground text-sm">
					<span>
						{t("workspace.cloud.database.rowCount", {
							count: paging.total,
							countDisplay: formatNumber(paging.total, locale),
						})}
					</span>
					<div className="flex items-center gap-2">
						<span>
							{t("workspace.cloud.database.rows.page", {
								page: formatNumber(paging.page, locale),
								pageCount: formatNumber(pageCount, locale),
							})}
						</span>
						<Button
							variant="outline"
							size="icon-sm"
							aria-label={t("workspace.cloud.database.rows.previous")}
							disabled={paging.page <= 1}
							onClick={() => paging.onPageChange(paging.page - 1)}
						>
							{/* In RTL the previous page sits on the right, so the icon mirrors. */}
							<ChevronLeft className="size-4 rtl:-scale-x-100" />
						</Button>
						<Button
							variant="outline"
							size="icon-sm"
							aria-label={t("workspace.cloud.database.rows.next")}
							disabled={paging.page >= pageCount}
							onClick={() => paging.onPageChange(paging.page + 1)}
						>
							<ChevronRight className="size-4 rtl:-scale-x-100" />
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}

/** Grey bars in place of a grid or a table list that loads for the first time. */
export function RowsGridSkeleton() {
	return (
		<div aria-busy="true" className="flex flex-col gap-3 py-2">
			{SKELETON_BARS.map((width, row) => (
				<Skeleton
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
					key={row}
					className="h-4 rounded-full"
					style={{ width: `${width}%` }}
				/>
			))}
		</div>
	);
}

/** One cell: text as it is, other JSON as JSON text, and SQL null as a dim label. */
function CellValue({
	value,
	nullLabel,
}: {
	/** One JSON value of a row; a column the row lacks arrives as null. */
	value: SqlRow[string];
	/** Translated label of a SQL null. */
	nullLabel: string;
}) {
	if (value === null) {
		return <span className="text-muted-foreground italic">{nullLabel}</span>;
	}
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return <span title={text}>{text}</span>;
}
