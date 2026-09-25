/**
 * Database panel of the Cloud tab: the table list, the rows of the open
 * table, and the SQL editor, in two sections. Rendered by cloud-tab.tsx
 * inside backend-state.tsx, so the backend is `active` here. Reads
 * cloudTablesQuery and cloudRowsQuery; renders rows-grid.tsx and sql-editor.tsx.
 */

import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type { CloudTable } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@wandit/ui/components/tabs";
import { ArrowLeft, Database, SearchX, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { formatNumber, useTranslation } from "@/lib/i18n";
import {
	cloudKeys,
	cloudRowsQuery,
	cloudTablesQuery,
} from "../../api/cloud.queries";
import { CLOUD_ROWS_PAGE_SIZE } from "../../lib/constants";
import { CodeMessage } from "../code/code-viewer";
import { RowsGrid, RowsGridSkeleton, type SortDirection } from "./rows-grid";
import { SqlEditor } from "./sql-editor";

/** Props of DatabasePanel. The panel mounts only while the backend is `active`. */
export type DatabasePanelProps = {
	projectId: string;
	/** True while the Cloud view is on screen. The queries of the panel wait for it. */
	isActive: boolean;
};

/**
 * Tables and SQL editor of one project. Both sections stay mounted, so a
 * switch between them keeps the open page and the SQL draft.
 */
export function DatabasePanel({ projectId, isActive }: DatabasePanelProps) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	// The backend is `active` here (backend-state.tsx), so only the view gates the read.
	const tables = useQuery(cloudTablesQuery(projectId, isActive));
	const [openTableName, setOpenTableName] = useState<string | null>(null);
	// A table that a migration dropped leaves the list, and the list shows again.
	const openTable = tables.data?.find((table) => table.name === openTableName);

	// A 409 can mean the backend fell asleep. The retry reads the backend
	// state too, so the tab can show the wake-up block.
	function retry() {
		void queryClient.invalidateQueries({ queryKey: cloudKeys.all(projectId) });
	}

	// The rows view can find a table gone that the list still shows, so the
	// list reads again on the way back.
	function closeTable() {
		setOpenTableName(null);
		void queryClient.invalidateQueries({
			queryKey: cloudKeys.tables(projectId),
		});
	}

	function renderTables() {
		if (tables.isPending) {
			return <RowsGridSkeleton />;
		}
		// A failed refetch keeps the last good list; only a failed first load has no data.
		if (tables.data === undefined) {
			return (
				<CodeMessage
					icon={TriangleAlert}
					text={t("workspace.cloud.database.tables.loadFailed")}
				>
					<Button variant="outline" size="sm" onClick={retry}>
						{t("workspace.cloud.retry")}
					</Button>
				</CodeMessage>
			);
		}
		if (openTable) {
			return (
				<TableRows
					// A new table starts on page 1 with the default sort.
					key={openTable.name}
					projectId={projectId}
					table={openTable}
					isActive={isActive}
					onBack={closeTable}
					onRetry={retry}
				/>
			);
		}
		if (tables.data.length === 0) {
			return (
				<CodeMessage
					icon={Database}
					text={t("workspace.cloud.database.tables.empty")}
				/>
			);
		}
		return <TablesList tables={tables.data} onOpen={setOpenTableName} />;
	}

	return (
		<Tabs defaultValue="tables" className="gap-4">
			<TabsList>
				<TabsTrigger value="tables">
					{t("workspace.cloud.database.sections.tables")}
				</TabsTrigger>
				<TabsTrigger value="sql">
					{t("workspace.cloud.database.sections.sql")}
				</TabsTrigger>
			</TabsList>
			{/* Both sections stay mounted, so the open page and the SQL draft survive a switch. */}
			<TabsContent
				value="tables"
				forceMount
				className="min-w-0 data-[state=inactive]:hidden"
			>
				{renderTables()}
			</TabsContent>
			<TabsContent
				value="sql"
				forceMount
				className="min-w-0 data-[state=inactive]:hidden"
			>
				<SqlEditor projectId={projectId} />
			</TabsContent>
		</Tabs>
	);
}

/** The `public` tables with their column and row counts. A click on a name opens its rows. */
function TablesList({
	tables,
	onOpen,
}: {
	tables: CloudTable[];
	onOpen: (tableName: string) => void;
}) {
	const { t, locale } = useTranslation();

	return (
		<div className="rounded-xl border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t("workspace.cloud.database.tables.name")}</TableHead>
						<TableHead className="text-end">
							{t("workspace.cloud.database.tables.columns")}
						</TableHead>
						<TableHead className="text-end">
							{t("workspace.cloud.database.tables.rows")}
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{tables.map((table) => (
						<TableRow key={table.name}>
							<TableCell>
								<button
									type="button"
									dir="ltr"
									onClick={() => onOpen(table.name)}
									className="rounded-sm font-medium font-mono text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
								>
									{table.name}
								</button>
							</TableCell>
							<TableCell className="text-end text-muted-foreground">
								{formatNumber(table.columns.length, locale)}
							</TableCell>
							<TableCell className="text-end text-muted-foreground">
								{/* The list count is a Postgres estimate; the rows view shows the exact count. */}
								{table.rowCountExact
									? formatNumber(table.rowCount, locale)
									: t("workspace.cloud.database.tables.estimate", {
											count: formatNumber(table.rowCount, locale),
										})}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

/** One table: a back button, its name, and the paged grid of its rows. */
function TableRows({
	projectId,
	table,
	isActive,
	onBack,
	onRetry,
}: {
	projectId: string;
	/** The open table from the tables answer; its columns give the grid columns. */
	table: CloudTable;
	isActive: boolean;
	onBack: () => void;
	/** Reads the backend state, the tables, and the rows again. */
	onRetry: () => void;
}) {
	const { t } = useTranslation();
	const [page, setPage] = useState(1);
	// undefined sorts by the first column, the server default.
	const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
	const [direction, setDirection] = useState<SortDirection>("asc");
	const columns = table.columns.map((column) => column.name);
	// A refreshed column list can drop the sorted column; the server default sort then applies again.
	const activeSort =
		sortColumn !== undefined && columns.includes(sortColumn)
			? sortColumn
			: undefined;
	const rows = useQuery({
		...cloudRowsQuery(
			projectId,
			table.name,
			{
				page,
				pageSize: CLOUD_ROWS_PAGE_SIZE,
				sort: activeSort,
				dir: direction,
			},
			// A table without columns has no rows to read; the server refuses the sort.
			isActive && columns.length > 0,
		),
		// The old page stays on screen while the next page or sort loads.
		placeholderData: keepPreviousData,
	});
	// A write or a turn can delete rows. A page past the new end moves to the last page.
	const lastPage = rows.data
		? Math.max(1, Math.ceil(rows.data.total / CLOUD_ROWS_PAGE_SIZE))
		: page;
	if (!rows.isPlaceholderData && page > lastPage) {
		setPage(lastPage);
	}

	// A column that Postgres cannot order (json, point) fails on every read,
	// so the retry also goes back to the default sort.
	function retryRows() {
		setSortColumn(undefined);
		setDirection("asc");
		onRetry();
	}

	function renderRows() {
		const firstColumn = columns[0];
		if (firstColumn === undefined) {
			return (
				<CodeMessage
					icon={Database}
					text={t("workspace.cloud.database.rows.noColumns")}
				/>
			);
		}
		// null: a migration dropped the table after the list loaded. The back
		// button above reads the list again.
		if (rows.data === null) {
			return (
				<CodeMessage
					icon={SearchX}
					text={t("workspace.cloud.database.rows.missing")}
				/>
			);
		}
		if (rows.data === undefined && !rows.isPending) {
			return (
				<CodeMessage
					icon={TriangleAlert}
					text={t("workspace.cloud.database.rows.loadFailed")}
				>
					<Button variant="outline" size="sm" onClick={retryRows}>
						{t("workspace.cloud.retry")}
					</Button>
				</CodeMessage>
			);
		}
		return (
			<RowsGrid
				columns={columns}
				rows={rows.data?.items}
				emptyText={t("workspace.cloud.database.rows.empty")}
				isStale={rows.isPlaceholderData}
				paging={{
					page,
					pageSize: CLOUD_ROWS_PAGE_SIZE,
					total: rows.data?.total ?? 0,
					onPageChange: setPage,
				}}
				sort={{
					column: activeSort ?? firstColumn,
					direction,
					onSortChange: (column, nextDirection) => {
						setSortColumn(column);
						setDirection(nextDirection);
						// A new order starts on the first page.
						setPage(1);
					},
				}}
			/>
		);
	}

	return (
		<div className="flex min-w-0 flex-col gap-3">
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="sm" onClick={onBack}>
					{/* In RTL the list sits on the right, so the arrow mirrors. */}
					<ArrowLeft className="rtl:-scale-x-100" />
					{t("workspace.cloud.database.tables.back")}
				</Button>
				<span dir="ltr" className="truncate font-medium font-mono text-sm">
					{table.name}
				</span>
			</div>
			{renderRows()}
		</div>
	);
}
