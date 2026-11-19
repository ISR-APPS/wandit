// The table card body of the list and home pages: a filter field, filter buttons, a column menu,
// sortable heads, row checkboxes, a row menu, and pages. A page passes its rows and its columns.
// The home table cards and the list pages render it inside a Card. It adds no fetch and no dependency.
// Search, sort, selection, hidden columns, and the page are state; the shown rows are derived during render.
import { DotsThreeIcon, PlusCircleIcon } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Checkbox } from "~/shared/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { ArrowsDownUpIcon, CaretDownIcon, CheckIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

/** One column of RecordTable. */
export type RecordColumn<Row extends { id: string }> = {
	/** Stable id of the column. The column menu and the sort state use it. */
	id: string;
	/** Header text, already translated. */
	header: string;
	/** The content of one cell. Put a Link to the detail page in the name cell. */
	cell: (row: Row) => ReactNode;
	/** Sort key of a row. The header is a sort button only when this exists. */
	sortValue?: (row: Row) => string | number;
	/** "end" for numbers and amounts. */
	align?: "start" | "end";
	/** True lists the column in the Columns menu, so the user can hide it. Keep the name column always shown. */
	hideable?: boolean;
};

/** Props of RecordTable. `Row.id` keys the rows and the selection. */
export type RecordTableProps<Row extends { id: string }> = {
	/** Every row of the list, as the query returns them, after the filters of the page. */
	rows: Row[];
	columns: RecordColumn<Row>[];
	/** Text that the filter field matches. No filter field when absent. */
	searchText?: (row: Row) => string;
	/** Placeholder of the filter field, for example "Filter deals…". */
	searchPlaceholder?: string;
	/** Filter buttons (RecordFilter) after the filter field. */
	toolbar?: ReactNode;
	/** The DropdownMenuItem children of the menu of one row. No menu column when absent. */
	rowMenu?: (row: Row) => ReactNode;
	/** True adds a checkbox column and the "x of y rows selected" line. */
	selectable?: boolean;
	/** Buttons that act on the selected rows, for example "Export selected". They show while a row is selected. */
	bulkActions?: (selectedRows: Row[]) => ReactNode;
	/** Rows per page: 8 on a home card, 20 on a list page. */
	pageSize: number;
	/** Text when no row matches the filter. */
	noResults: string;
};

/** The active sort: the column id and the direction. */
type SortState = { columnId: string; direction: "ascending" | "descending" };

/** A table of `rows` in the kit table card anatomy. Every control works on the rows of the browser. */
export function RecordTable<Row extends { id: string }>({
	rows,
	columns,
	searchText,
	searchPlaceholder,
	toolbar,
	rowMenu,
	selectable = false,
	bulkActions,
	pageSize,
	noResults,
}: RecordTableProps<Row>) {
	const { t, locale } = useT();
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<SortState | null>(null);
	const [page, setPage] = useState(1);
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
		new Set(),
	);
	const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());

	// LIMIT: sorts, filters, and pages in the browser; the list query loads at most 1,000 rows (the Supabase default). Upgrade: server paging with .range() and .ilike() (tables-paging.md of the app-dashboard skill).
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

	const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
	// A filter or a refetch can shrink the list below the current page, so clamp here.
	const currentPage = Math.min(page, pageCount);
	const firstIndex = (currentPage - 1) * pageSize;
	const pageRows = sorted.slice(firstIndex, firstIndex + pageSize);
	const visibleColumns = columns.filter((column) => !hiddenIds.has(column.id));
	const hideableColumns = columns.filter((column) => column.hideable);
	// A selected row that the filter hides leaves the count and the bulk actions, and comes back with the filter.
	const selectedRows = matches.filter((row) => selectedIds.has(row.id));
	const pageSelectedCount = pageRows.filter((row) =>
		selectedIds.has(row.id),
	).length;
	const number = new Intl.NumberFormat(locale);
	const columnCount =
		visibleColumns.length + (selectable ? 1 : 0) + (rowMenu ? 1 : 0);

	function toggleSort(columnId: string) {
		setSort((current) =>
			current?.columnId === columnId && current.direction === "ascending"
				? { columnId, direction: "descending" }
				: { columnId, direction: "ascending" },
		);
	}

	function setRowsSelected(ids: string[], isSelected: boolean) {
		setSelectedIds((current) => {
			const next = new Set(current);
			for (const id of ids) {
				if (isSelected) {
					next.add(id);
				} else {
					next.delete(id);
				}
			}
			return next;
		});
	}

	function toggleColumn(columnId: string) {
		setHiddenIds((current) => {
			const next = new Set(current);
			if (next.has(columnId)) {
				next.delete(columnId);
			} else {
				next.add(columnId);
			}
			return next;
		});
	}

	return (
		<div className="grid min-w-0">
			{searchText ||
			toolbar ||
			hideableColumns.length > 0 ||
			selectedRows.length > 0 ? (
				<div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
					{searchText ? (
						<Input
							type="search"
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								setPage(1);
							}}
							placeholder={searchPlaceholder ?? t("table.search")}
							aria-label={searchPlaceholder ?? t("table.search")}
							className="w-full sm:max-w-sm"
						/>
					) : null}
					{toolbar}
					{bulkActions && selectedRows.length > 0
						? bulkActions(selectedRows)
						: null}
					{hideableColumns.length > 0 ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" className="ms-auto">
									{t("table.columns")}
									<CaretDownIcon />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-44">
								{hideableColumns.map((column) => {
									const isVisible = !hiddenIds.has(column.id);
									return (
										<DropdownMenuItem
											key={column.id}
											role="menuitemcheckbox"
											aria-checked={isVisible}
											// The menu stays open, so the user can hide several columns in a row.
											onSelect={(event) => {
												event.preventDefault();
												toggleColumn(column.id);
											}}
										>
											<CheckIcon
												className={cn("size-4", isVisible ? "" : "invisible")}
											/>
											{column.header}
										</DropdownMenuItem>
									);
								})}
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</div>
			) : null}
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							{selectable ? (
								<TableHead className="w-10 ps-3">
									<Checkbox
										aria-label={t("table.selectPage")}
										checked={
											pageRows.length > 0 &&
											pageSelectedCount === pageRows.length
												? true
												: pageSelectedCount > 0
													? "indeterminate"
													: false
										}
										onCheckedChange={(checked) =>
											setRowsSelected(
												pageRows.map((row) => row.id),
												checked === true,
											)
										}
									/>
								</TableHead>
							) : null}
							{visibleColumns.map((column) => (
								<TableHead
									key={column.id}
									aria-sort={
										column.sortValue
											? sort?.columnId === column.id
												? sort.direction
												: "none"
											: undefined
									}
									className={cn(
										"font-medium text-muted-foreground",
										column.align === "end" && "text-end",
									)}
								>
									{column.sortValue ? (
										// text-sm replaces the text-xs of size sm, so sortable and plain headers have one text size.
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className={cn(
												"text-sm",
												column.align === "end" ? "-me-3" : "-ms-3",
											)}
											onClick={() => toggleSort(column.id)}
										>
											{column.header}
											<ArrowsDownUpIcon className="size-3.5" />
										</Button>
									) : (
										column.header
									)}
								</TableHead>
							))}
							{rowMenu ? (
								<TableHead className="w-12">
									<span className="sr-only">{t("table.actions")}</span>
								</TableHead>
							) : null}
						</TableRow>
					</TableHeader>
					<TableBody>
						{pageRows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={columnCount}
									className="h-24 text-center text-muted-foreground"
								>
									{noResults}
								</TableCell>
							</TableRow>
						) : (
							pageRows.map((row) => {
								const isSelected = selectedIds.has(row.id);
								return (
									<TableRow
										key={row.id}
										data-state={isSelected ? "selected" : undefined}
									>
										{selectable ? (
											<TableCell className="ps-3">
												<Checkbox
													aria-label={t("table.selectRow")}
													checked={isSelected}
													onCheckedChange={(checked) =>
														setRowsSelected([row.id], checked === true)
													}
												/>
											</TableCell>
										) : null}
										{visibleColumns.map((column) => (
											<TableCell
												key={column.id}
												className={cn(
													column.align === "end" && "text-end tabular-nums",
												)}
											>
												{column.cell(row)}
											</TableCell>
										))}
										{rowMenu ? (
											<TableCell className="text-end">
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															className="size-8"
															aria-label={t("table.rowActions")}
														>
															<DotsThreeIcon className="size-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end" className="min-w-40">
														{rowMenu(row)}
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										) : null}
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center gap-2 pt-4">
				<p className="flex-1 text-muted-foreground text-sm tabular-nums">
					{selectable
						? t("table.selectedCount")
								.replace("{selected}", number.format(selectedRows.length))
								.replace("{count}", number.format(matches.length))
						: t("table.range")
								.replace(
									"{from}",
									number.format(pageRows.length === 0 ? 0 : firstIndex + 1),
								)
								.replace("{to}", number.format(firstIndex + pageRows.length))
								.replace("{count}", number.format(sorted.length))}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={currentPage === 1}
					onClick={() => setPage(currentPage - 1)}
				>
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
				</Button>
			</div>
		</div>
	);
}

/** One choice of a RecordFilter. */
export type RecordFilterOption = {
	/** The value that the page compares with its rows, for example a stage or an owner id. */
	value: string;
	/** The translated label of the choice. */
	label: string;
};

type RecordFilterProps = {
	/** The translated name of the filter, for example "Owner". */
	label: string;
	options: RecordFilterOption[];
	/** The chosen value, or null for no filter. The page holds it and filters its rows before RecordTable. */
	value: string | null;
	/** Gets the new value, or null when the user clears the filter or picks the chosen value again. */
	onValueChange: (value: string | null) => void;
};

/** A filter button of the table toolbar: a dashed-in label, and the chosen value as a badge. */
export function RecordFilter({
	label,
	options,
	value,
	onValueChange,
}: RecordFilterProps) {
	const { t } = useT();
	const chosen = options.find((option) => option.value === value);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-9">
					<PlusCircleIcon />
					{label}
					{chosen ? (
						<Badge variant="secondary" className="ms-1 max-w-32 truncate">
							{chosen.label}
						</Badge>
					) : null}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-72 min-w-48">
				{options.map((option) => {
					const isChosen = option.value === value;
					return (
						<DropdownMenuItem
							key={option.value}
							role="menuitemradio"
							aria-checked={isChosen}
							onSelect={() => onValueChange(isChosen ? null : option.value)}
						>
							<CheckIcon
								className={cn("size-4", isChosen ? "" : "invisible")}
							/>
							<span className="truncate">{option.label}</span>
						</DropdownMenuItem>
					);
				})}
				{chosen ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => onValueChange(null)}>
							{t("table.clearFilter")}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
