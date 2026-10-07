// List table with sort, search, and paging, for the list pages behind login.
// A list page passes its rows and its columns; this file adds no fetch and no dependency.
// Sort, search, and paging are derived during render from three pieces of state.

import {
	ArrowUpDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	SearchIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Input } from "~/shared/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

// 20 rows fill one laptop screen and keep the page short on a phone.
const PAGE_SIZE = 20;

/** One column of DataTable. */
export type DataTableColumn<Row extends { id: string }> = {
	/** Stable id of the column. */
	id: string;
	/** Header text, already translated. */
	header: string;
	/** The content of one cell. Put a Link to the detail page in the name cell. */
	cell: (row: Row) => ReactNode;
	/** Sort key of a row. The header is a sort button only when this exists. */
	sortValue?: (row: Row) => string | number;
	/** end for numbers and amounts. */
	align?: "start" | "end";
};

/** Props of DataTable. `Row.id` keys the table rows. */
export type DataTableProps<Row extends { id: string }> = {
	/** Every row of the list, as the list query returns them. */
	rows: Row[];
	columns: DataTableColumn<Row>[];
	/** Text that the search box matches. No search box when absent. */
	searchText?: (row: Row) => string;
	/** Page filters (status Tabs, one Select), shown beside the search. */
	toolbar?: ReactNode;
	/** Text when no row matches the search. Zero rows is the empty state of the page. */
	noResults: string;
};

/** The active sort: the column id and the direction. */
type SortState = { columnId: string; direction: "ascending" | "descending" };

/** A table of `rows` with a search box, sortable headers, and pages of 20 rows. */
export function DataTable<Row extends { id: string }>({
	rows,
	columns,
	searchText,
	toolbar,
	noResults,
}: DataTableProps<Row>) {
	const { t, locale } = useT();
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<SortState | null>(null);
	const [page, setPage] = useState(1);

	// LIMIT: sorts, searches, and pages in the browser; the list query loads at most 1,000 rows (the Supabase default). Upgrade: server paging with .range() and .ilike() (tables-paging.md of the app-dashboard skill).
	const needle = query.trim().toLocaleLowerCase(locale);
	const matches =
		searchText && needle
			? rows.filter((row) =>
					searchText(row).toLocaleLowerCase(locale).includes(needle),
				)
			: rows;

	const sortValue = columns.find(
		(column) => column.id === sort?.columnId,
	)?.sortValue;
	// Numeric collation sorts "item 2" before "item 10", in the order of the app language.
	const collator = new Intl.Collator(locale, { numeric: true });
	const sorted =
		sort && sortValue
			? [...matches].sort((first, second) => {
					const a = sortValue(first);
					const b = sortValue(second);
					const order =
						typeof a === "number" && typeof b === "number"
							? a - b
							: collator.compare(String(a), String(b));
					return sort.direction === "ascending" ? order : -order;
				})
			: matches;

	const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
	// A search or a refetch can shrink the list below the current page, so clamp here.
	const currentPage = Math.min(page, pageCount);
	const firstIndex = (currentPage - 1) * PAGE_SIZE;
	const pageRows = sorted.slice(firstIndex, firstIndex + PAGE_SIZE);
	const numberFormat = new Intl.NumberFormat(locale);

	function toggleSort(columnId: string) {
		setSort((current) =>
			current?.columnId === columnId && current.direction === "ascending"
				? { columnId, direction: "descending" }
				: { columnId, direction: "ascending" },
		);
	}

	return (
		<div className="grid gap-3">
			{searchText || toolbar ? (
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					{searchText ? (
						<div className="relative w-full sm:max-w-xs">
							<SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								type="search"
								value={query}
								onChange={(event) => {
									setQuery(event.target.value);
									setPage(1);
								}}
								placeholder={t("table.search")}
								aria-label={t("table.search")}
								className="ps-8"
							/>
						</div>
					) : null}
					{toolbar}
				</div>
			) : null}
			<Table>
				<TableHeader>
					<TableRow>
						{columns.map((column) => (
							<TableHead
								key={column.id}
								aria-sort={
									column.sortValue
										? sort?.columnId === column.id
											? sort.direction
											: "none"
										: undefined
								}
								className={cn(column.align === "end" && "text-end")}
							>
								{column.sortValue ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											"h-8",
											column.align === "end" ? "-me-3" : "-ms-3",
										)}
										onClick={() => toggleSort(column.id)}
									>
										{column.header}
										<ArrowUpDownIcon className="text-muted-foreground" />
									</Button>
								) : (
									column.header
								)}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{pageRows.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={columns.length}
								className="h-24 text-center text-muted-foreground"
							>
								{noResults}
							</TableCell>
						</TableRow>
					) : (
						pageRows.map((row) => (
							<TableRow key={row.id}>
								{columns.map((column) => (
									<TableCell
										key={column.id}
										className={cn(
											column.align === "end" && "text-end tabular-nums",
										)}
									>
										{column.cell(row)}
									</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
			{pageCount > 1 ? (
				<div className="flex items-center justify-end gap-2">
					<p className="me-auto text-muted-foreground text-sm tabular-nums">
						{`${numberFormat.format(firstIndex + 1)}–${numberFormat.format(firstIndex + pageRows.length)} / ${numberFormat.format(sorted.length)}`}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={currentPage === 1}
						onClick={() => setPage(currentPage - 1)}
					>
						<ChevronLeftIcon className="rtl:rotate-180" />
						{t("table.previous")}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={currentPage === pageCount}
						onClick={() => setPage(currentPage + 1)}
					>
						{t("table.next")}
						<ChevronRightIcon className="rtl:rotate-180" />
					</Button>
				</div>
			) : null}
		</div>
	);
}
