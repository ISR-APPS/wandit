# Tables: server paging

Read this file only when a table can pass 1,000 rows (orders, events, payments).
It changes the work orders example of `tables.md`: the list query, the route, and the list page.

Use it in place of the browser paging when a table can pass 1,000 rows.
The search box sends on Enter, so each search is one request.
The status tabs show every status with no count: a count per status needs one more query.

### File: src/features/work-orders/lib/work-order-search.ts

```ts
// The URL search params of the server-paged work order list: ?q=&status=&sort=&page=.
// The list route validates them with this schema. A bad value falls back to its default, so an old link still opens.
// workOrdersPageQueryOptions reads the sort map, the page size, and the escape function.
import { z } from "zod";
import { WORK_ORDER_STATUSES } from "./work-order-status";

/** Rows per page, the same as DataTable. */
export const WORK_ORDERS_PAGE_SIZE = 20;

/** `.default()` makes each param optional in a Link; `.catch()` replaces a bad value. */
export const workOrderSearchSchema = z.object({
	q: z.string().trim().max(100).default("").catch(""),
	status: z
		.enum(["all", ...WORK_ORDER_STATUSES])
		.default("all")
		.catch("all"),
	sort: z
		.enum(["newest", "due", "reference"])
		.default("newest")
		.catch("newest"),
	page: z.coerce.number().int().min(1).default(1).catch(1),
});

/** The parsed search params of the list. */
export type WorkOrderSearch = z.infer<typeof workOrderSearchSchema>;

/** The column and the direction of each sort key. The URL holds the key, never a column name. */
export const WORK_ORDER_SORTS = {
	newest: { column: "created_at", ascending: false },
	due: { column: "due_at", ascending: true },
	reference: { column: "reference", ascending: true },
} satisfies Record<
	WorkOrderSearch["sort"],
	{ column: string; ascending: boolean }
>;

// LIMIT: PostgREST reads * as %, so a * in the search matches any text. Upgrade: a search rpc.
/** Escapes \, %, and _ for ilike. A search for "50%" then finds "50%" only, not every text with "50". */
export function escapeLikePattern(text: string): string {
	return text.replace(/[\\%_]/g, "\\$&");
}
```

### Add to: src/features/work-orders/api/work-orders.queries.ts

Add the import, then the function.

```ts
import {
	escapeLikePattern,
	WORK_ORDER_SORTS,
	WORK_ORDERS_PAGE_SIZE,
	type WorkOrderSearch,
} from "../lib/work-order-search";

/** One page of work orders and the total count. The database filters, sorts, and counts. */
export function workOrdersPageQueryOptions(search: WorkOrderSearch) {
	return queryOptions({
		queryKey: ["work-orders", "page", search],
		queryFn: async () => {
			const sort = WORK_ORDER_SORTS[search.sort];
			const from = (search.page - 1) * WORK_ORDERS_PAGE_SIZE;
			// LIMIT: an exact count scans every matching row. Upgrade: count: "estimated" above about 100,000 rows.
			let query = getSupabase()
				.from("work_orders")
				.select(WORK_ORDER_COLUMNS, { count: "exact" })
				.order(sort.column, { ascending: sort.ascending })
				// The id breaks ties, so no row shows on two pages.
				.order("id")
				.range(from, from + WORK_ORDERS_PAGE_SIZE - 1);
			if (search.status !== "all") {
				query = query.eq("status", search.status);
			}
			if (search.q !== "") {
				query = query.ilike("reference", `%${escapeLikePattern(search.q)}%`);
			}
			const { data, error, count } = await query;
			// PGRST103: the page starts after the last row (an old link). Show an empty page, not an error.
			// supabase-js drops the count on an error, so the total is 0 here.
			if (error?.code === "PGRST103") {
				return { rows: [], total: 0 };
			}
			if (error) {
				throw error;
			}
			return { rows: z.array(workOrderSchema).parse(data), total: count ?? 0 };
		},
	});
}
```

### File: src/routes/app/work-orders/index.tsx (server paging)

Replace the list route with this one, and export `workOrderSearchSchema`, `workOrdersPageQueryOptions`,
and `WorkOrdersPagedPage` from the feature `index.ts`.
Then `WorkOrdersPage` has no caller. Delete it, its export, and the imports that only it uses.
Keep `WorkOrdersEmpty`, `WorkOrdersPageSkeleton`, and `WorkOrdersPageError` in `work-orders-page.tsx`, and update its header.
Delete `workOrdersQueryOptions` too when no other file reads it.

```tsx
// The server-paged work order list behind login. The /app layout checks the session first.
// validateSearch parses ?q=&status=&sort=&page=. A new search runs the loader again with the new deps.
import { createFileRoute } from "@tanstack/react-router";
import {
	WorkOrdersPagedPage,
	WorkOrdersPageError,
	WorkOrdersPageSkeleton,
	workOrderSearchSchema,
	workOrdersPageQueryOptions,
} from "~/features/work-orders";

/** /app/work-orders with the page state in the URL, so a link opens the same page. */
export const Route = createFileRoute("/app/work-orders/")({
	validateSearch: workOrderSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps }) =>
		context.queryClient.query(workOrdersPageQueryOptions(deps)),
	pendingComponent: WorkOrdersPageSkeleton,
	errorComponent: WorkOrdersPageError,
	component: WorkOrdersPagedPage,
});
```

### File: src/features/work-orders/components/work-orders-paged-page.tsx

```tsx
// The server-paged work order list: the search box, the status tabs, the sort Select, the table, and the pager.
// The /app/work-orders route renders it. Each control writes the URL; the route loader then loads the page.
// It reuses the empty state, the skeleton, and the error of work-orders-page.tsx.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { formatRelativeTime } from "~/shared/lib/relative-time";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { workOrdersPageQueryOptions } from "../api/work-orders.queries";
import {
	WORK_ORDERS_PAGE_SIZE,
	workOrderSearchSchema,
} from "../lib/work-order-search";
import {
	WORK_ORDER_STATUS_BADGE,
	WORK_ORDER_STATUSES,
} from "../lib/work-order-status";
import { WorkOrderFormDialog } from "./work-order-form-dialog";
import { WorkOrderRowActions } from "./work-order-row-actions";
import { WorkOrdersEmpty } from "./work-orders-page";

/** One page of work orders from the database. The URL holds the search, the status, the sort, and the page. */
export function WorkOrdersPagedPage() {
	const { t, locale } = useT();
	const search = useSearch({ from: "/app/work-orders/" });
	const navigate = useNavigate({ from: "/app/work-orders/" });
	const { data } = useSuspenseQuery(workOrdersPageQueryOptions(search));
	const [isCreating, setIsCreating] = useState(false);

	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const now = Date.now();
	const pageCount = Math.max(1, Math.ceil(data.total / WORK_ORDERS_PAGE_SIZE));
	const firstIndex = (search.page - 1) * WORK_ORDERS_PAGE_SIZE;
	// No row with no filter is the empty state. A page after the end also gives 0, so page 1 only.
	const hasNoWorkOrder =
		data.total === 0 &&
		search.q === "" &&
		search.status === "all" &&
		search.page === 1;

	function onSearch(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const q = new FormData(event.currentTarget).get("q");
		navigate({
			search: (previous) => ({
				...previous,
				q: typeof q === "string" ? q : "",
				page: 1,
			}),
		});
	}

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("workOrders.title")}
				description={t("workOrders.description")}
				actions={
					<Button type="button" onClick={() => setIsCreating(true)}>
						{t("workOrders.add")}
					</Button>
				}
			/>
			{hasNoWorkOrder ? (
				<WorkOrdersEmpty onAdd={() => setIsCreating(true)} />
			) : (
				<Card>
					<CardContent className="grid gap-3">
						{/* min-w-0: the tabs scroll inside the card and never widen the page at 375 px. */}
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							<form onSubmit={onSearch} className="relative w-full sm:max-w-xs">
								<SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								{/* The key resets the box when the URL changes, for example on Back. */}
								<Input
									key={search.q}
									type="search"
									name="q"
									maxLength={100}
									defaultValue={search.q}
									placeholder={t("table.search")}
									aria-label={t("table.search")}
									className="ps-8"
								/>
							</form>
							<Tabs
								value={search.status}
								onValueChange={(value) =>
									navigate({
										search: (previous) => ({
											...previous,
											status: workOrderSearchSchema.shape.status.parse(value),
											page: 1,
										}),
									})
								}
								className="max-w-full overflow-x-auto"
							>
								<TabsList>
									<TabsTrigger value="all">{t("workOrders.all")}</TabsTrigger>
									{WORK_ORDER_STATUSES.map((status) => (
										<TabsTrigger key={status} value={status}>
											{t(`workOrders.statuses.${status}`)}
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
							<Select
								value={search.sort}
								onValueChange={(value) =>
									navigate({
										search: (previous) => ({
											...previous,
											sort: workOrderSearchSchema.shape.sort.parse(value),
											page: 1,
										}),
									})
								}
							>
								<SelectTrigger
									className="w-auto"
									aria-label={t("workOrders.sort")}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="newest">
										{t("workOrders.sortNewest")}
									</SelectItem>
									<SelectItem value="due">{t("workOrders.sortDue")}</SelectItem>
									<SelectItem value="reference">
										{t("workOrders.sortReference")}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("workOrders.reference")}</TableHead>
									<TableHead>{t("workOrders.status")}</TableHead>
									<TableHead>{t("workOrders.due")}</TableHead>
									<TableHead className="text-end">
										{t("workOrders.progress")}
									</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="h-24 text-center text-muted-foreground"
										>
											{t("workOrders.noResults")}
										</TableCell>
									</TableRow>
								) : (
									data.rows.map((row) => (
										<TableRow key={row.id}>
											<TableCell>
												{/* justify-items-start: dir="auto" text sits at the start side in Arabic too. */}
												<div className="grid justify-items-start">
													<Link
														to="/app/work-orders/$id"
														params={{ id: row.id }}
														className="font-medium hover:underline"
														dir="auto"
													>
														{row.reference}
													</Link>
													<span
														className="text-muted-foreground text-xs"
														dir="auto"
													>
														{row.product}
													</span>
												</div>
											</TableCell>
											<TableCell>
												<Badge variant={WORK_ORDER_STATUS_BADGE[row.status]}>
													{t(`workOrders.statuses.${row.status}`)}
												</Badge>
											</TableCell>
											<TableCell>
												{formatRelativeTime(row.due_at, now, locale)}
											</TableCell>
											<TableCell className="text-end tabular-nums">
												{percent.format(
													row.quantity_done / row.quantity_target,
												)}
											</TableCell>
											<TableCell className="text-end">
												<WorkOrderRowActions workOrder={row} />
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
						<div className="flex items-center justify-end gap-2">
							<p className="me-auto text-muted-foreground text-sm tabular-nums">
								{data.rows.length > 0
									? `${number.format(firstIndex + 1)}–${number.format(firstIndex + data.rows.length)} / ${number.format(data.total)}`
									: null}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={search.page === 1}
								onClick={() =>
									navigate({
										search: (previous) => ({
											...previous,
											// A page after the end has no count, so Previous then opens page 1.
											page: Math.min(search.page - 1, pageCount),
										}),
									})
								}
							>
								<ChevronLeftIcon className="rtl:rotate-180" />
								{t("table.previous")}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={search.page >= pageCount}
								onClick={() =>
									navigate({
										search: (previous) => ({
											...previous,
											page: search.page + 1,
										}),
									})
								}
							>
								{t("table.next")}
								<ChevronRightIcon className="rtl:rotate-180" />
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
			<WorkOrderFormDialog open={isCreating} onOpenChange={setIsCreating} />
		</div>
	);
}
```
