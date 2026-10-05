/**
 * The rows grid of the Cloud panels of the More view: one table page with
 * sort headers and page controls, or one SQL result without them. Pure
 * presentation: the caller owns the page, the sort, and the query. Rendered
 * by database-panel.tsx and sql-editor.tsx; builds on the Table of
 * @wandit/ui. Also exports the table look of every Cloud panel, the page
 * controls of users-panel.tsx, and the first-load skeleton.
 */

import { ArrowDownIcon } from "@phosphor-icons/react/ArrowDown";
import { ArrowUpIcon } from "@phosphor-icons/react/ArrowUp";
import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { RowsIcon } from "@phosphor-icons/react/Rows";
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

import { formatNumber, useTranslation } from "@/lib/i18n";
import {
	PANEL_CARD_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
	PanelMessage,
} from "../more/panel-shell";
import { IconAction } from "../shell/top-bar";

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

/**
 * The one table look of the Cloud panels, on the div around a kit Table: a
 * white card, a grotesk header row on a faint navy wash, 13 px body rows
 * with hairlines. Descendant selectors beat the kit classes of the cells.
 */
export const CLOUD_TABLE_CLASS = cn(
	PANEL_CARD_CLASS,
	"overflow-hidden text-night/85 dark:text-foreground/85 [&_table]:text-[13px]",
	"[&_thead_tr]:border-night/[0.07] [&_thead_tr]:bg-night/[0.025] [&_thead_tr]:hover:bg-night/[0.025] dark:[&_thead_tr]:border-white/[0.07] dark:[&_thead_tr]:bg-white/[0.03] dark:[&_thead_tr]:hover:bg-white/[0.03]",
	"[&_th]:h-10 [&_th]:px-4 [&_th]:font-grotesk [&_th]:font-medium [&_th]:text-[12px] [&_th]:text-night/55 dark:[&_th]:text-foreground/55",
	"[&_td]:px-4 [&_td]:py-2.5",
	"[&_tbody_tr]:border-night/[0.06] [&_tbody_tr]:hover:bg-night/[0.02] dark:[&_tbody_tr]:border-white/[0.06] dark:[&_tbody_tr]:hover:bg-white/[0.03]",
);

/** Faint text of a secondary cell, like a date or a count. */
export const CLOUD_CELL_MUTED_CLASS =
	"text-night/55 tabular-nums dark:text-foreground/55";

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

	return (
		<div className="flex min-w-0 flex-col gap-3">
			{rows.length === 0 ? (
				<PanelMessage icon={RowsIcon} text={emptyText} />
			) : (
				// The Table wraps itself in `overflow-x-auto`: a generated table can be wider than the panel.
				<div
					aria-busy={isStale}
					className={cn(
						CLOUD_TABLE_CLASS,
						"transition-opacity",
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
										sortedDirection === "desc" ? ArrowDownIcon : ArrowUpIcon;
									return (
										<TableHead
											key={column}
											dir="ltr"
											aria-sort={
												sortedDirection ? ARIA_SORT[sortedDirection] : undefined
											}
										>
											{/* Column names are identifiers, so they stay in the mono face. */}
											{sort ? (
												<button
													type="button"
													onClick={() => sortBy(column)}
													className={cn(
														"inline-flex items-center gap-1 rounded-sm font-mono text-[12px] outline-none transition-colors hover:text-night focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:text-foreground",
														sortedDirection &&
															"text-night dark:text-foreground",
													)}
												>
													{column}
													{sortedDirection ? (
														<SortIcon
															aria-hidden
															weight="bold"
															className="size-3 text-ember-text"
														/>
													) : null}
												</button>
											) : (
												<span className="font-mono text-[12px]">{column}</span>
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
											className="max-w-80 truncate font-mono text-[12.5px]"
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
				<PageControls
					{...paging}
					countText={t("workspace.cloud.database.rowCount", {
						count: paging.total,
						countDisplay: formatNumber(paging.total, locale),
					})}
				/>
			) : null}
		</div>
	);
}

/** Props of PageControls. `countText` is the translated total, for example "120 rows". */
export type PageControlsProps = NonNullable<RowsGridProps["paging"]> & {
	countText: string;
};

/**
 * The total, "Page x of y", and the previous and next buttons under a paged
 * list. Rendered by RowsGrid and by the users list of users-panel.tsx.
 */
export function PageControls({
	page,
	pageSize,
	total,
	onPageChange,
	countText,
}: PageControlsProps) {
	const { t, locale } = useTranslation();
	const pageCount = Math.max(1, Math.ceil(total / pageSize));

	return (
		<div className="flex items-center justify-between gap-3 px-1 font-grotesk text-[13px] text-night/55 tabular-nums dark:text-foreground/55">
			<span>{countText}</span>
			<div className="flex items-center gap-1.5">
				<span className="me-1.5">
					{t("workspace.cloud.database.rows.page", {
						page: formatNumber(page, locale),
						pageCount: formatNumber(pageCount, locale),
					})}
				</span>
				<IconAction label={t("workspace.cloud.database.rows.previous")}>
					<Button
						variant="outline"
						size="icon-sm"
						className={PANEL_SECONDARY_BUTTON_CLASS}
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
					>
						{/* In RTL the previous page sits on the right, so the icon mirrors. */}
						<CaretLeftIcon
							aria-hidden
							weight="bold"
							className="rtl:-scale-x-100"
						/>
					</Button>
				</IconAction>
				<IconAction label={t("workspace.cloud.database.rows.next")}>
					<Button
						variant="outline"
						size="icon-sm"
						className={PANEL_SECONDARY_BUTTON_CLASS}
						disabled={page >= pageCount}
						onClick={() => onPageChange(page + 1)}
					>
						<CaretRightIcon
							aria-hidden
							weight="bold"
							className="rtl:-scale-x-100"
						/>
					</Button>
				</IconAction>
			</div>
		</div>
	);
}

/** Grey bars in a card, in place of a grid or a list that loads for the first time. */
export function RowsGridSkeleton() {
	return (
		<div
			aria-busy="true"
			className={cn(PANEL_CARD_CLASS, "flex flex-col gap-4 px-5 py-5")}
		>
			{SKELETON_BARS.map((width, row) => (
				<Skeleton
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
					key={row}
					className="h-3.5 rounded-full bg-night/[0.06] dark:bg-white/[0.07]"
					style={{ width: `${width}%` }}
				/>
			))}
		</div>
	);
}

/** One cell: text as it is, other JSON as JSON text, and SQL null as a faint label. */
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
		return (
			<span className="text-night/35 italic dark:text-foreground/35">
				{nullLabel}
			</span>
		);
	}
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return <span title={text}>{text}</span>;
}
