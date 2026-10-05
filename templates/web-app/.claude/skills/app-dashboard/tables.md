# Tables: list pages, detail pages, and forms

Each main entity gets one list page and one detail page (or a form page).
The example below is complete and tested: the work orders of the factory in `data.md`.
Copy its shape for each entity. Rename the files, the keys, and the columns.

## 1. List page

- The route file is thin: the loader calls `context.queryClient.query(...)`,
  and it sets `pendingComponent` and `errorComponent`.
- The page starts with `PageHeader` and the main action "Add <entity>".
- Status `Tabs` with a count sit in the DataTable `toolbar`. Show a tab only for a status that has rows.
  The tab filters the rows before DataTable gets them. At most one Select filter joins the tabs.
- `DataTable` from `~/shared/ui/data-table` searches, sorts, and pages in the browser. Give it `searchText`.
- Zero rows is the empty state: one muted sentence and the action that adds the first row.
  `noResults` is the text for a search with no match.
- The list query orders by newest and has `.limit(1000)` with its `LIMIT` comment. More rows: section 6.

## 2. Columns

- The name cell is a `Link` to `/app/<entity>/$id` with a muted second line.
- User text in a plain cell (a machine name) goes in `<bdi>`. The two `dir="auto"` lines of the name cell sit in `grid justify-items-start`.
  In Arabic, a `dir="auto"` block alone puts Latin text at the left edge, away from its header.
- A status is a `Badge`. The variant comes from a map `satisfies Record<Status, BadgeVariant>`.
- Numbers and amounts use `align: "end"`. DataTable adds `tabular-nums`.
- Operational times (a due time, the last event) use `formatRelativeTime`. Records (a creation date) use an absolute date.
- Row actions sit in a `DropdownMenu` with an `aria-label` on the trigger. A menu item opens a controlled dialog.

## 3. Detail page

- A back link to the list comes first. Then `PageHeader`: the name as h1, the status Badge in the description,
  and the actions at the end.
- A grid `@5xl/main:grid-cols-3`: the main column spans 2 (key facts as a `dl`, the related events table).
  The rail spans 1 (progress, notes, and the status history when a `status_changes` table exists).
- An id that does not exist shows a not-found block with the back link. It is not an error.

## 4. Create and edit

- 6 fields or fewer: a `Dialog`. More fields: a page with its own route.
- One zod schema in `lib/` checks the form. The inputs carry the same limits (`required`, `maxLength`, `min`, `max`).
- A success shows a toast and closes the dialog. The mutation invalidates the entity key and `["overview"]`.
- A failure keeps the dialog open with one error line.

## 5. Delete

- A confirm `Dialog` names the consequence. The delete button uses `variant="destructive"`.
- A delete from the detail page goes back to the list.

## 6. More than 1,000 rows: server paging

Use it when a table can pass 1,000 rows (orders, events, payments). `tables-paging.md` has the code.
The URL holds the state: `?q=&status=&sort=&page=`. The database filters, sorts, and counts.

## Work orders example

### Add to: src/shared/ui/icons.tsx

The sidebar entries need the Lucide icons `layout-dashboard` (the home) and `clipboard-list`.
Add them after the last icon.

```tsx
/** Lucide layout-dashboard. The home nav item. */
export function LayoutDashboardIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<rect width="7" height="9" x="3" y="3" rx="1" />
			<rect width="7" height="5" x="14" y="3" rx="1" />
			<rect width="7" height="9" x="14" y="12" rx="1" />
			<rect width="7" height="5" x="3" y="16" rx="1" />
		</Icon>
	);
}

/** Lucide clipboard-list. The Work orders nav item. */
export function ClipboardListIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
			<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
			<path d="M12 11h4" />
			<path d="M12 16h4" />
			<path d="M8 11h.01" />
			<path d="M8 16h.01" />
		</Icon>
	);
}
```

### Add to: src/features/app-shell/lib/nav-items.ts

Import `ClipboardListIcon` and `LayoutDashboardIcon` from `~/shared/ui/icons`.
Add these entries at the start of `NAV_ITEMS`. The home comes first, and Profile stays last.

```ts
	{ to: "/app", labelKey: "overview.title", icon: LayoutDashboardIcon },
	{
		to: "/app/work-orders",
		labelKey: "workOrders.title",
		icon: ClipboardListIcon,
	},
```

### Add to: src/shared/i18n/messages.ts

```ts
	workOrders: {
		title: "Work orders",
		description: "Every order of the workshop, newest first.",
		add: "Add work order",
		addFirst: "Add the first work order",
		empty: "No work order yet. Add one to plan the production.",
		noResults: "No work order matches the search.",
		loadError:
			"The work orders did not load. Check the connection and try again.",
		all: "All",
		reference: "Reference",
		product: "Product",
		status: "Status",
		due: "Due",
		progress: "Progress",
		actions: "Actions for this work order",
		open: "Open",
		edit: "Edit",
		delete: "Delete",
		cancel: "Cancel",
		formDescription: "The quantity done comes from the production entries.",
		quantityTarget: "Target quantity",
		quantityDone: "Quantity done",
		notes: "Notes",
		noNotes: "No notes.",
		invalid: "Check the fields and try again.",
		saveError: "The work order was not saved. Try again.",
		created: "Work order added.",
		updated: "Work order saved.",
		deleteTitle: "Delete this work order?",
		deleteBody:
			"Its production entries stay, with no link to it. You cannot undo this.",
		deleteError: "The work order was not deleted. Try again.",
		deleted: "Work order deleted.",
		notFound:
			"This work order does not exist. It was deleted, or the link is wrong.",
		details: "Details",
		createdAt: "Created",
		events: "Production entries",
		noEvents: "No production entry for this work order yet.",
		eventTime: "When",
		machine: "Machine",
		deletedMachine: "Deleted machine",
		quantity: "Good units",
		scrap: "Scrap",
		sort: "Sort",
		sortNewest: "Newest",
		sortDue: "Due date",
		sortReference: "Reference",
		statuses: {
			planned: "Planned",
			in_progress: "In progress",
			blocked: "Blocked",
			done: "Done",
		},
	},
```

### File: src/features/work-orders/lib/work-order-status.ts

```ts
// The statuses of a work order and the Badge variant of each one.
// The check constraint of public.work_orders.status holds the same four values.
// The list page, the detail page, the form, and the home cards read this file.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every status, in the order of the work. The tabs and the form Select follow this order. */
export const WORK_ORDER_STATUSES = [
	"planned",
	"in_progress",
	"blocked",
	"done",
] as const;

/** One status. Its label is the message key `workOrders.statuses.<status>`. */
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per status. Blocked is the only red one, done the only green one. */
export const WORK_ORDER_STATUS_BADGE = {
	planned: "secondary",
	in_progress: "info",
	blocked: "destructive",
	done: "success",
} satisfies Record<WorkOrderStatus, BadgeVariant>;
```

### File: src/features/work-orders/lib/work-order-form.ts

```ts
// The form of a work order: the zod schema and the due date conversions.
// WorkOrderFormDialog parses the FormData with the schema. useSaveWorkOrderMutation writes the values.
// The limits repeat the check constraints of public.work_orders, so the database accepts every valid form.
import { z } from "zod";
import { WORK_ORDER_STATUSES } from "./work-order-status";

/** Fields of the work order form. Each key is the `name` of one input. */
export const workOrderFormSchema = z.object({
	reference: z.string().trim().min(1).max(60),
	product: z.string().trim().min(1).max(120),
	status: z.enum(WORK_ORDER_STATUSES),
	// <input type="date"> sends YYYY-MM-DD.
	dueDate: z.iso.date(),
	quantityTarget: z.coerce.number().int().min(1).max(1_000_000),
	notes: z.string().trim().max(2000),
});

/** The form values after the parse. */
export type WorkOrderFormValues = z.infer<typeof workOrderFormSchema>;

/** The end of the due day in the browser time zone, as ISO. A work order is late from the next day. */
export function dueDateToTimestamp(dueDate: string): string {
	// A date-time text with no offset is local time in JavaScript.
	return new Date(`${dueDate}T23:59:59`).toISOString();
}

/** The local day of an ISO timestamp, as YYYY-MM-DD: the value format of <input type="date">. */
export function timestampToDueDate(timestamp: string): string {
	const date = new Date(timestamp);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}
```

### File: src/shared/lib/relative-time.ts

The list and detail pages of every entity use it, and each entity is its own feature. So it lives in `shared/`.

```ts
// Formats a time as "tomorrow", "in 3 days", or "2 hours ago" in the app language.
// List pages and detail pages use it for operational times: a due time, the last event.
// A record date (a creation date) uses an absolute Intl.DateTimeFormat date instead.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Midnight at the start of the local day of `ms`, in milliseconds since 1970.
function startOfLocalDay(ms: number): number {
	return new Date(ms).setHours(0, 0, 0, 0);
}

/**
 * `timestamp` (ISO) against `now` (milliseconds since 1970), in the browser time zone.
 * Days are calendar days: a due time of 23:59 tomorrow reads "tomorrow" at any time today.
 */
export function formatRelativeTime(
	timestamp: string,
	now: number,
	locale: string,
): string {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	const time = Date.parse(timestamp);
	const differenceMs = time - now;
	// Under 45 minutes, minutes are exact. Just after midnight, "yesterday" would hide "20 minutes ago".
	if (Math.abs(differenceMs) < 45 * MINUTE_MS) {
		// Under 45 seconds reads "now".
		return Math.abs(differenceMs) < 45_000
			? format.format(0, "second")
			: format.format(Math.round(differenceMs / MINUTE_MS), "minute");
	}
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	const days = Math.round(
		(startOfLocalDay(time) - startOfLocalDay(now)) / DAY_MS,
	);
	if (days !== 0) {
		return format.format(days, "day");
	}
	// The same calendar day: "in 5 hours" is more exact than "today".
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}
```

### File: src/features/work-orders/api/work-orders.queries.ts

```ts
// Reads of work orders: the list, one work order, and its production events.
// The list and detail routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// RLS returns only the rows of the signed-in user.
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabase } from "~/shared/lib/supabase";
import { WORK_ORDER_STATUSES } from "../lib/work-order-status";

// The columns that the pages read. workOrderSchema parses the same names.
const WORK_ORDER_COLUMNS =
	"id, reference, product, status, due_at, quantity_target, quantity_done, notes, created_at";

const workOrderSchema = z.object({
	id: z.uuid(),
	reference: z.string(),
	product: z.string(),
	status: z.enum(WORK_ORDER_STATUSES),
	due_at: z.iso.datetime({ offset: true }),
	quantity_target: z.number(),
	quantity_done: z.number(),
	notes: z.string().nullable(),
	created_at: z.iso.datetime({ offset: true }),
});

/** One row of public.work_orders. The times are ISO texts with an offset. */
export type WorkOrder = z.infer<typeof workOrderSchema>;

/** Every work order, newest first. The list page searches, sorts, and pages them in the browser. */
export function workOrdersQueryOptions() {
	return queryOptions({
		queryKey: ["work-orders", "list"],
		queryFn: async () => {
			// LIMIT: the newest 1,000 rows, paged in the browser. Upgrade: server paging (tables-paging.md).
			const { data, error } = await getSupabase()
				.from("work_orders")
				.select(WORK_ORDER_COLUMNS)
				.order("created_at", { ascending: false })
				.limit(1000);
			if (error) {
				throw error;
			}
			return z.array(workOrderSchema).parse(data);
		},
	});
}

/** One work order, or null when the id does not exist or belongs to another user. */
export function workOrderQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["work-orders", "detail", id],
		queryFn: async () => {
			// The id comes from the URL. A text that is not a UUID is "not found", not a database error.
			if (!z.uuid().safeParse(id).success) {
				return null;
			}
			const { data, error } = await getSupabase()
				.from("work_orders")
				.select(WORK_ORDER_COLUMNS)
				.eq("id", id)
				.maybeSingle();
			if (error) {
				throw error;
			}
			return workOrderSchema.nullable().parse(data);
		},
	});
}

const productionEventSchema = z.object({
	id: z.uuid(),
	quantity: z.number(),
	scrap: z.number(),
	occurred_at: z.iso.datetime({ offset: true }),
	// The machine row, embedded through the (machine_id, owner_id) foreign key.
	// null when the user deletes the machine: the event stays, with machine_id null.
	machines: z.object({ name: z.string() }).nullable(),
});

/** One production event of a work order, with the name of its machine. */
export type ProductionEvent = z.infer<typeof productionEventSchema>;

/** The 50 newest production events of one work order. The detail page lists them. */
export function workOrderEventsQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["work-orders", "events", id],
		queryFn: async () => {
			if (!z.uuid().safeParse(id).success) {
				return [];
			}
			// LIMIT: the 50 newest entries, about two screens. Upgrade: a production page with server paging.
			const { data, error } = await getSupabase()
				.from("production_events")
				.select("id, quantity, scrap, occurred_at, machines(name)")
				.eq("work_order_id", id)
				.order("occurred_at", { ascending: false })
				.limit(50);
			if (error) {
				throw error;
			}
			return z.array(productionEventSchema).parse(data);
		},
	});
}
```

### File: src/features/work-orders/api/work-orders.mutations.ts

```ts
// Writes of work orders: save (create or edit) and delete.
// The form dialog and the delete dialog call these hooks. RLS lets a user write only their own rows.
// A success refetches the work order queries and the home KPIs, which count work orders.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "~/shared/lib/supabase";
import {
	dueDateToTimestamp,
	type WorkOrderFormValues,
} from "../lib/work-order-form";

/** Input of a save. No `id` creates a work order; an `id` edits that work order. */
type SaveWorkOrderInput = { id?: string; values: WorkOrderFormValues };

/** Creates or edits a work order. owner_id comes from the column default auth.uid(). */
export function useSaveWorkOrderMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, values }: SaveWorkOrderInput) => {
			const row = {
				reference: values.reference,
				product: values.product,
				status: values.status,
				due_at: dueDateToTimestamp(values.dueDate),
				quantity_target: values.quantityTarget,
				notes: values.notes === "" ? null : values.notes,
			};
			// An update that matches no row (another device deleted it) gives no error.
			// .single() then fails with PGRST116, so the dialog shows the save error.
			const { error } = id
				? await getSupabase()
						.from("work_orders")
						.update(row)
						.eq("id", id)
						.select("id")
						.single()
				: await getSupabase().from("work_orders").insert(row);
			if (error) {
				throw error;
			}
		},
		// The list, the detail page, and the home KPIs show work orders.
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ["work-orders"] }),
				queryClient.invalidateQueries({ queryKey: ["overview"] }),
			]),
	});
}

/** Deletes a work order. Its production events stay; the foreign key sets their work_order_id to null. */
export function useDeleteWorkOrderMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const { error } = await getSupabase()
				.from("work_orders")
				.delete()
				.eq("id", id);
			if (error) {
				throw error;
			}
		},
		// No await: the dialog closes and the page leaves before the lists refetch.
		// A refetch of the deleted row would show "not found" for a moment.
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["work-orders"] });
			void queryClient.invalidateQueries({ queryKey: ["overview"] });
		},
	});
}
```

### File: src/features/work-orders/components/work-order-form-dialog.tsx

```tsx
// The dialog that creates or edits a work order. It has 6 fields, so it is a dialog and not a page.
// The list page opens it to create. The row actions and the detail page open it to edit.
// It parses the FormData with workOrderFormSchema, saves, closes, and shows a toast.
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import { Input } from "~/shared/ui/input";
import { Label } from "~/shared/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Textarea } from "~/shared/ui/textarea";
import { useSaveWorkOrderMutation } from "../api/work-orders.mutations";
import type { WorkOrder } from "../api/work-orders.queries";
import {
	timestampToDueDate,
	workOrderFormSchema,
} from "../lib/work-order-form";
import { WORK_ORDER_STATUSES } from "../lib/work-order-status";

type WorkOrderFormDialogProps = {
	/** The work order to edit. When absent, the dialog creates a new one. */
	workOrder?: WorkOrder;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled dialog. Its content unmounts on close, so each open starts from the saved values. */
export function WorkOrderFormDialog({
	workOrder,
	open,
	onOpenChange,
}: WorkOrderFormDialogProps) {
	const { t } = useT();
	const saveWorkOrder = useSaveWorkOrderMutation();
	const [isInvalid, setIsInvalid] = useState(false);

	function changeOpen(next: boolean) {
		saveWorkOrder.reset();
		setIsInvalid(false);
		onOpenChange(next);
	}

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const parsed = workOrderFormSchema.safeParse(
			Object.fromEntries(new FormData(event.currentTarget)),
		);
		// The inputs check the same limits first. This catches a changed form, or a value of spaces only.
		setIsInvalid(!parsed.success);
		if (!parsed.success) {
			return;
		}
		saveWorkOrder.mutate(
			{ id: workOrder?.id, values: parsed.data },
			{
				onSuccess: () => {
					toast.success(
						t(workOrder ? "workOrders.updated" : "workOrders.created"),
					);
					changeOpen(false);
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={changeOpen}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{t(workOrder ? "workOrders.edit" : "workOrders.add")}
					</DialogTitle>
					<DialogDescription>
						{t("workOrders.formDescription")}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="grid gap-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="work-order-reference">
								{t("workOrders.reference")}
							</Label>
							<Input
								id="work-order-reference"
								name="reference"
								required
								maxLength={60}
								defaultValue={workOrder?.reference}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="work-order-product">
								{t("workOrders.product")}
							</Label>
							<Input
								id="work-order-product"
								name="product"
								required
								maxLength={120}
								defaultValue={workOrder?.product}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="work-order-status">
								{t("workOrders.status")}
							</Label>
							<Select
								name="status"
								defaultValue={workOrder?.status ?? "planned"}
							>
								<SelectTrigger id="work-order-status">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{WORK_ORDER_STATUSES.map((status) => (
										<SelectItem key={status} value={status}>
											{t(`workOrders.statuses.${status}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="work-order-due">{t("workOrders.due")}</Label>
							<Input
								id="work-order-due"
								name="dueDate"
								type="date"
								required
								defaultValue={
									workOrder ? timestampToDueDate(workOrder.due_at) : undefined
								}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="work-order-target">
								{t("workOrders.quantityTarget")}
							</Label>
							<Input
								id="work-order-target"
								name="quantityTarget"
								type="number"
								inputMode="numeric"
								required
								min={1}
								max={1_000_000}
								step={1}
								defaultValue={workOrder?.quantity_target}
							/>
						</div>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="work-order-notes">{t("workOrders.notes")}</Label>
						<Textarea
							id="work-order-notes"
							name="notes"
							maxLength={2000}
							defaultValue={workOrder?.notes ?? ""}
						/>
					</div>
					{isInvalid || saveWorkOrder.isError ? (
						<p className="text-destructive text-sm" role="alert">
							{t(isInvalid ? "workOrders.invalid" : "workOrders.saveError")}
						</p>
					) : null}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => changeOpen(false)}
						>
							{t("workOrders.cancel")}
						</Button>
						<Button type="submit" disabled={saveWorkOrder.isPending}>
							{t("common.save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
```

### File: src/features/work-orders/components/delete-work-order-dialog.tsx

```tsx
// The confirm dialog before a work order is deleted. A delete cannot be undone.
// The row actions and the detail page open it. The detail page passes onDeleted to leave the deleted page.
// It calls useDeleteWorkOrderMutation and shows a toast on success.
import { toast } from "sonner";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import { useDeleteWorkOrderMutation } from "../api/work-orders.mutations";
import type { WorkOrder } from "../api/work-orders.queries";

type DeleteWorkOrderDialogProps = {
	workOrder: WorkOrder;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Runs after a successful delete, for example a navigation back to the list. */
	onDeleted?: () => void;
};

/** A controlled confirm dialog. A failure keeps it open with one error line. */
export function DeleteWorkOrderDialog({
	workOrder,
	open,
	onOpenChange,
	onDeleted,
}: DeleteWorkOrderDialogProps) {
	const { t } = useT();
	const deleteWorkOrder = useDeleteWorkOrderMutation();

	function changeOpen(next: boolean) {
		deleteWorkOrder.reset();
		onOpenChange(next);
	}

	function onConfirm() {
		deleteWorkOrder.mutate(workOrder.id, {
			onSuccess: () => {
				toast.success(t("workOrders.deleted"));
				changeOpen(false);
				onDeleted?.();
			},
		});
	}

	return (
		<Dialog open={open} onOpenChange={changeOpen}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("workOrders.deleteTitle")}</DialogTitle>
					<DialogDescription>{t("workOrders.deleteBody")}</DialogDescription>
				</DialogHeader>
				{/* bdi isolates the user text. The line keeps the start side of the app language. */}
				<p className="font-medium text-sm">
					<bdi>{workOrder.reference}</bdi>
				</p>
				{deleteWorkOrder.isError ? (
					<p className="text-destructive text-sm" role="alert">
						{t("workOrders.deleteError")}
					</p>
				) : null}
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => changeOpen(false)}
					>
						{t("workOrders.cancel")}
					</Button>
					<Button
						type="button"
						variant="destructive"
						disabled={deleteWorkOrder.isPending}
						onClick={onConfirm}
					>
						{t("workOrders.delete")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
```

### File: src/features/work-orders/components/work-order-row-actions.tsx

```tsx
// The actions menu at the end of one work order row: open, edit, and delete.
// The list page renders it in the last column. Edit and delete open their dialogs from here.
// The dialogs sit outside the menu, so they stay open when the menu closes.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { MoreHorizontalIcon } from "~/shared/ui/icons";
import type { WorkOrder } from "../api/work-orders.queries";
import { DeleteWorkOrderDialog } from "./delete-work-order-dialog";
import { WorkOrderFormDialog } from "./work-order-form-dialog";

type WorkOrderRowActionsProps = {
	/** The row of the table. */
	workOrder: WorkOrder;
};

/** The "..." button of one row and the two dialogs that it opens. */
export function WorkOrderRowActions({ workOrder }: WorkOrderRowActionsProps) {
	const { t } = useT();
	const [openDialog, setOpenDialog] = useState<"edit" | "delete" | null>(null);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t("workOrders.actions")}
					>
						<MoreHorizontalIcon />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem asChild>
						<Link to="/app/work-orders/$id" params={{ id: workOrder.id }}>
							{t("workOrders.open")}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => setOpenDialog("edit")}>
						{t("workOrders.edit")}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setOpenDialog("delete")}
					>
						{t("workOrders.delete")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<WorkOrderFormDialog
				workOrder={workOrder}
				open={openDialog === "edit"}
				onOpenChange={(open) => setOpenDialog(open ? "edit" : null)}
			/>
			<DeleteWorkOrderDialog
				workOrder={workOrder}
				open={openDialog === "delete"}
				onOpenChange={(open) => setOpenDialog(open ? "delete" : null)}
			/>
		</>
	);
}
```

### File: src/features/work-orders/components/work-orders-page.tsx

```tsx
// The work order list behind login: the page header, the status tabs, and the searchable table.
// The /app/work-orders route renders it after its loader. The route also uses the skeleton and the error below.
// Zero work orders shows WorkOrdersEmpty, with the action that adds the first one.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { formatRelativeTime } from "~/shared/lib/relative-time";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type WorkOrder,
	workOrdersQueryOptions,
} from "../api/work-orders.queries";
import {
	WORK_ORDER_STATUS_BADGE,
	WORK_ORDER_STATUSES,
	type WorkOrderStatus,
} from "../lib/work-order-status";
import { WorkOrderFormDialog } from "./work-order-form-dialog";
import { WorkOrderRowActions } from "./work-order-row-actions";

/** The list page. The status tab filters the rows; then DataTable searches, sorts, and pages them. */
export function WorkOrdersPage() {
	const { t, locale } = useT();
	const { data: workOrders } = useSuspenseQuery(workOrdersQueryOptions());
	const [status, setStatus] = useState<WorkOrderStatus | "all">("all");
	const [isCreating, setIsCreating] = useState(false);

	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const now = Date.now();
	// A tab shows only for a status that has rows.
	const tabs = WORK_ORDER_STATUSES.map((value) => ({
		value,
		count: workOrders.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	// An edit can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? workOrders
			: workOrders.filter((row) => row.status === activeStatus);

	const columns: DataTableColumn<WorkOrder>[] = [
		{
			id: "reference",
			header: t("workOrders.reference"),
			sortValue: (row) => row.reference,
			// justify-items-start: each line is as wide as its text. Then dir="auto" text sits at the start side in Arabic too.
			cell: (row) => (
				<div className="grid justify-items-start">
					<Link
						to="/app/work-orders/$id"
						params={{ id: row.id }}
						className="font-medium hover:underline"
						dir="auto"
					>
						{row.reference}
					</Link>
					<span className="text-muted-foreground text-xs" dir="auto">
						{row.product}
					</span>
				</div>
			),
		},
		{
			id: "status",
			header: t("workOrders.status"),
			sortValue: (row) => WORK_ORDER_STATUSES.indexOf(row.status),
			cell: (row) => (
				<Badge variant={WORK_ORDER_STATUS_BADGE[row.status]}>
					{t(`workOrders.statuses.${row.status}`)}
				</Badge>
			),
		},
		{
			id: "due",
			header: t("workOrders.due"),
			sortValue: (row) => Date.parse(row.due_at),
			cell: (row) => formatRelativeTime(row.due_at, now, locale),
		},
		{
			id: "progress",
			header: t("workOrders.progress"),
			align: "end",
			sortValue: (row) => row.quantity_done / row.quantity_target,
			cell: (row) => percent.format(row.quantity_done / row.quantity_target),
		},
		{
			id: "actions",
			header: "",
			align: "end",
			cell: (row) => <WorkOrderRowActions workOrder={row} />,
		},
	];

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
			{workOrders.length === 0 ? (
				<WorkOrdersEmpty onAdd={() => setIsCreating(true)} />
			) : (
				<Card>
					<CardContent>
						<DataTable
							rows={rows}
							columns={columns}
							searchText={(row) => `${row.reference} ${row.product}`}
							noResults={t("workOrders.noResults")}
							toolbar={
								<Tabs
									value={activeStatus}
									onValueChange={(value) =>
										setStatus(
											WORK_ORDER_STATUSES.find((option) => option === value) ??
												"all",
										)
									}
									className="max-w-full overflow-x-auto"
								>
									<TabsList>
										<TabsTrigger value="all">
											{t("workOrders.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(workOrders.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.value} value={tab.value}>
												{t(`workOrders.statuses.${tab.value}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
							}
						/>
					</CardContent>
				</Card>
			)}
			<WorkOrderFormDialog open={isCreating} onOpenChange={setIsCreating} />
		</div>
	);
}

type WorkOrdersEmptyProps = {
	/** Opens the create dialog of the page. */
	onAdd: () => void;
};

/** The empty state when the user has no work order. The server-paged page uses it too. */
export function WorkOrdersEmpty({ onAdd }: WorkOrdersEmptyProps) {
	const { t } = useT();
	return (
		<Card>
			<CardContent className="grid justify-items-center gap-3 py-10 text-center">
				<p className="text-muted-foreground text-sm">{t("workOrders.empty")}</p>
				<Button type="button" variant="outline" onClick={onAdd}>
					{t("workOrders.addFirst")}
				</Button>
			</CardContent>
		</Card>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function WorkOrdersPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-64" />
				</div>
				<Skeleton className="h-9 w-36" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-10 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list when the loader fails. Try again runs the loader again. */
export function WorkOrdersPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("workOrders.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
```

### File: src/features/work-orders/components/work-order-detail-page.tsx

```tsx
// The detail page of one work order: its header and status, the key facts, the production entries, and the notes.
// The /app/work-orders/$id route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { formatRelativeTime } from "~/shared/lib/relative-time";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { ChevronLeftIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import {
	workOrderEventsQueryOptions,
	workOrderQueryOptions,
} from "../api/work-orders.queries";
import { WORK_ORDER_STATUS_BADGE } from "../lib/work-order-status";
import { DeleteWorkOrderDialog } from "./delete-work-order-dialog";
import { WorkOrderFormDialog } from "./work-order-form-dialog";

type WorkOrderDetailPageProps = {
	/** The `$id` param of the URL. The query treats a text that is not a UUID as not found. */
	id: string;
};

/** The detail page. A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function WorkOrderDetailPage({ id }: WorkOrderDetailPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: workOrder } = useSuspenseQuery(workOrderQueryOptions(id));
	const { data: events } = useSuspenseQuery(workOrderEventsQueryOptions(id));
	const [openDialog, setOpenDialog] = useState<"edit" | "delete" | null>(null);

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/work-orders">
				<ChevronLeftIcon className="rtl:rotate-180" />
				{t("workOrders.title")}
			</Link>
		</Button>
	);
	if (!workOrder) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("workOrders.notFound")}
				</p>
			</div>
		);
	}

	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const now = Date.now();

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={workOrder.reference}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<Badge variant={WORK_ORDER_STATUS_BADGE[workOrder.status]}>
							{t(`workOrders.statuses.${workOrder.status}`)}
						</Badge>
						<span dir="auto">{workOrder.product}</span>
					</span>
				}
				actions={
					<>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpenDialog("edit")}
						>
							{t("workOrders.edit")}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpenDialog("delete")}
						>
							{t("workOrders.delete")}
						</Button>
					</>
				}
			/>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="font-medium text-sm">
								{t("workOrders.details")}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid @xl/main:grid-cols-2 gap-4 text-sm">
								<div className="grid gap-1">
									<dt className="text-muted-foreground">
										{t("workOrders.due")}
									</dt>
									<dd>
										{dateTime.format(new Date(workOrder.due_at))}
										<span className="text-muted-foreground">
											{` · ${formatRelativeTime(workOrder.due_at, now, locale)}`}
										</span>
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="text-muted-foreground">
										{t("workOrders.createdAt")}
									</dt>
									<dd>{date.format(new Date(workOrder.created_at))}</dd>
								</div>
								<div className="grid gap-1">
									<dt className="text-muted-foreground">
										{t("workOrders.quantityTarget")}
									</dt>
									<dd className="tabular-nums">
										{number.format(workOrder.quantity_target)}
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="text-muted-foreground">
										{t("workOrders.quantityDone")}
									</dt>
									<dd className="tabular-nums">
										{number.format(workOrder.quantity_done)}
									</dd>
								</div>
							</dl>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle className="font-medium text-sm">
								{t("workOrders.events")}
							</CardTitle>
						</CardHeader>
						<CardContent>
							{events.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{t("workOrders.noEvents")}
								</p>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{t("workOrders.eventTime")}</TableHead>
											<TableHead>{t("workOrders.machine")}</TableHead>
											<TableHead className="text-end">
												{t("workOrders.quantity")}
											</TableHead>
											<TableHead className="text-end">
												{t("workOrders.scrap")}
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{events.map((event) => (
											<TableRow key={event.id}>
												<TableCell>
													{formatRelativeTime(event.occurred_at, now, locale)}
												</TableCell>
												{/* bdi isolates the user text. The cell keeps the start side of its header. */}
												<TableCell>
													<bdi>
														{event.machines
															? event.machines.name
															: t("workOrders.deletedMachine")}
													</bdi>
												</TableCell>
												<TableCell className="text-end tabular-nums">
													{number.format(event.quantity)}
												</TableCell>
												<TableCell className="text-end tabular-nums">
													{number.format(event.scrap)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</div>
				<div className="grid gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="font-medium text-sm">
								{t("workOrders.progress")}
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3">
							<p className="font-display text-3xl tabular-nums">
								{percent.format(
									workOrder.quantity_done / workOrder.quantity_target,
								)}
							</p>
							<Progress
								value={workOrder.quantity_done}
								max={workOrder.quantity_target}
							/>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle className="font-medium text-sm">
								{t("workOrders.notes")}
							</CardTitle>
						</CardHeader>
						{/* A short note sits at the start side. A long note fills the card and keeps its own direction. */}
						<CardContent className="grid justify-items-start">
							{workOrder.notes ? (
								<p className="whitespace-pre-line text-sm" dir="auto">
									{workOrder.notes}
								</p>
							) : (
								<p className="text-muted-foreground text-sm">
									{t("workOrders.noNotes")}
								</p>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
			<WorkOrderFormDialog
				workOrder={workOrder}
				open={openDialog === "edit"}
				onOpenChange={(open) => setOpenDialog(open ? "edit" : null)}
			/>
			<DeleteWorkOrderDialog
				workOrder={workOrder}
				open={openDialog === "delete"}
				onOpenChange={(open) => setOpenDialog(open ? "delete" : null)}
				onDeleted={() => navigate({ to: "/app/work-orders" })}
			/>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function WorkOrderDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-32" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-5 w-40" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<Skeleton className="@5xl/main:col-span-2 h-64" />
				<Skeleton className="h-40" />
			</div>
		</div>
	);
}
```

### File: src/features/work-orders/index.ts

```ts
export {
	type WorkOrder,
	workOrderEventsQueryOptions,
	workOrderQueryOptions,
	workOrdersQueryOptions,
} from "./api/work-orders.queries";
export {
	WorkOrderDetailPage,
	WorkOrderDetailPageSkeleton,
} from "./components/work-order-detail-page";
export {
	WorkOrdersPage,
	WorkOrdersPageError,
	WorkOrdersPageSkeleton,
} from "./components/work-orders-page";
export {
	WORK_ORDER_STATUS_BADGE,
	WORK_ORDER_STATUSES,
	type WorkOrderStatus,
} from "./lib/work-order-status";
```

### File: src/routes/app/work-orders/index.tsx

```tsx
// The work order list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the work-orders feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	WorkOrdersPage,
	WorkOrdersPageError,
	WorkOrdersPageSkeleton,
	workOrdersQueryOptions,
} from "~/features/work-orders";

/** /app/work-orders: the list of every work order of the user. */
export const Route = createFileRoute("/app/work-orders/")({
	loader: ({ context }) => context.queryClient.query(workOrdersQueryOptions()),
	pendingComponent: WorkOrdersPageSkeleton,
	errorComponent: WorkOrdersPageError,
	component: WorkOrdersPage,
});
```

### File: src/routes/app/work-orders/$id.tsx

```tsx
// The detail page of one work order. The /app layout checks the session first.
// The loader fills the work order and its events in parallel. Thin: the page lives in the work-orders feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	WorkOrderDetailPage,
	WorkOrderDetailPageSkeleton,
	WorkOrdersPageError,
	workOrderEventsQueryOptions,
	workOrderQueryOptions,
} from "~/features/work-orders";

/** /app/work-orders/$id. `params.id` is any text from the URL; the query checks it. */
export const Route = createFileRoute("/app/work-orders/$id")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(workOrderQueryOptions(params.id)),
			context.queryClient.query(workOrderEventsQueryOptions(params.id)),
		]),
	pendingComponent: WorkOrderDetailPageSkeleton,
	errorComponent: WorkOrdersPageError,
	component: WorkOrderDetailRoute,
});

function WorkOrderDetailRoute() {
	const { id } = Route.useParams();
	return <WorkOrderDetailPage id={id} />;
}
```
