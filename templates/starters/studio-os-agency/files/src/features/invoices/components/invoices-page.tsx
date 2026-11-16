// The invoice list behind login: four money figures, the status tabs, and the searchable table.
// The /app/invoices route renders it after its loader, and also uses the skeleton and the error below.
// An invoice number opens the invoice dialog with its lines.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	daysFromToday,
	type Figure,
	FigureBand,
	INVOICE_STATUSES,
	InvoiceBadge,
	type InvoiceRow,
	type InvoiceStatus,
	isInLastDays,
	PageError,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { useSidebar } from "~/shared/ui/sidebar";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { invoicesQueryOptions } from "../api/invoices.queries";
import { InvoiceDialog } from "./invoice-dialog";

// The "Collected" figure sums the payments of the last 30 days.
const COLLECTED_DAYS = 30;

/** The list page. The status tab filters the rows; then DataTable searches, sorts, and pages them. */
export function InvoicesPage() {
	const { t, locale } = useT();
	const format = useFormatters();
	const { data: invoices } = useSuspenseQuery(invoicesQueryOptions());
	// A phone shows the invoice and the amount. The client and the status move under them.
	const { isMobile } = useSidebar();
	const [status, setStatus] = useState<InvoiceStatus | "all">("all");
	// The dialog keeps the last invoice while it fades out, so it never closes empty.
	const [openId, setOpenId] = useState<string | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const number = new Intl.NumberFormat(locale);
	const rows =
		status === "all"
			? invoices
			: invoices.filter((invoice) => invoice.status === status);
	const sumOf = (list: InvoiceRow[]) =>
		list.reduce((sum, invoice) => sum + invoice.amount, 0);
	const withStatus = (value: InvoiceStatus) =>
		invoices.filter((invoice) => invoice.status === value);
	const figures: Figure[] = [
		{
			id: "outstanding",
			label: t("invoices.figures.outstanding"),
			value: format.money(
				sumOf([...withStatus("sent"), ...withStatus("overdue")]),
			),
		},
		{
			id: "overdue",
			label: t("invoices.figures.overdue"),
			value: format.money(sumOf(withStatus("overdue"))),
			isBad: withStatus("overdue").length > 0,
		},
		{
			id: "collected",
			label: t("invoices.figures.collected"),
			value: format.money(
				sumOf(
					invoices.filter(
						(invoice) =>
							invoice.paidDay !== null &&
							isInLastDays(invoice.paidDay, COLLECTED_DAYS),
					),
				),
			),
		},
		{
			id: "drafts",
			label: t("invoices.figures.drafts"),
			value: format.money(sumOf(withStatus("draft"))),
		},
	];

	const columns: DataTableColumn<InvoiceRow>[] = [
		{
			id: "number",
			header: t("invoices.invoice"),
			sortValue: (row) => row.number ?? "",
			cell: (row) => (
				<div className="grid justify-items-start">
					<button
						type="button"
						onClick={() => {
							setOpenId(row.id);
							setIsDialogOpen(true);
						}}
						// min-h-11 gives the button a 44 px touch area on a phone.
						className={cn(
							"inline-flex min-h-11 items-center font-medium tabular-nums hover:underline md:min-h-0",
							row.number === null && "text-muted-foreground",
						)}
					>
						{row.number ?? t("invoices.draftNumber")}
					</button>
					{isMobile ? (
						<span className="text-muted-foreground text-xs">
							{row.clientName}
						</span>
					) : null}
				</div>
			),
		},
		{
			id: "amount",
			header: t("invoices.amount"),
			align: "end",
			sortValue: (row) => row.amount,
			cell: (row) => (
				<div className="grid justify-items-end gap-1">
					<span className="font-medium">{format.money(row.amount)}</span>
					{isMobile ? <InvoiceBadge status={row.status} /> : null}
				</div>
			),
		},
		{
			id: "status",
			header: t("invoices.status"),
			sortValue: (row) => INVOICE_STATUSES.indexOf(row.status),
			cell: (row) => <InvoiceBadge status={row.status} />,
		},
		{
			id: "project",
			header: t("invoices.project"),
			sortValue: (row) => row.projectName,
			// The client sits under the project, so the six columns fit a 1024 px screen.
			cell: (row) => (
				<div className="grid justify-items-start">
					<Link
						to="/app/projects/$projectId"
						params={{ projectId: row.projectId }}
						className="hover:underline"
					>
						{row.projectName}
					</Link>
					<span className="text-muted-foreground text-xs">
						{row.clientName}
					</span>
				</div>
			),
		},
		{
			id: "issued",
			header: t("invoices.issued"),
			sortValue: (row) => daysFromToday(row.issueDay),
			// A draft is not sent yet. Its issue day is the planned day, so it reads "Planned".
			cell: (row) =>
				row.status === "draft" ? (
					<span className="text-muted-foreground">
						{t("invoices.plannedOn").replace(
							"{day}",
							format.shortDate(row.issueDay),
						)}
					</span>
				) : (
					format.shortDate(row.issueDay)
				),
		},
		{
			id: "due",
			header: t("invoices.due"),
			sortValue: (row) => daysFromToday(row.dueDay),
			cell: (row) =>
				row.paidDay ? (
					<span className="text-muted-foreground">
						{t("invoices.paidOn").replace(
							"{day}",
							format.shortDate(row.paidDay),
						)}
					</span>
				) : (
					<span
						className={cn(
							row.status === "overdue" && "font-medium text-destructive",
						)}
					>
						{format.relativeDay(row.dueDay)}
					</span>
				),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("invoices.title")}
				description={t("invoices.description")}
			/>
			<FigureBand figures={figures} />
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={isMobile ? columns.slice(0, 2) : columns}
						searchText={(row) =>
							`${row.number ?? ""} ${row.clientName} ${row.projectName}`
						}
						noResults={t("invoices.noResults")}
						toolbar={
							<Tabs
								value={status}
								onValueChange={(value) =>
									setStatus(
										INVOICE_STATUSES.find((option) => option === value) ??
											"all",
									)
								}
								className="max-w-full overflow-x-auto"
							>
								{/* A phone wraps the tabs onto two lines, so no tab is cut at the edge. */}
								<TabsList className="max-md:h-auto! max-md:flex-wrap max-md:justify-start max-md:*:flex-none">
									<TabsTrigger value="all">
										{t("invoices.all")}
										<span className="tabular-nums opacity-60">
											{number.format(invoices.length)}
										</span>
									</TabsTrigger>
									{INVOICE_STATUSES.map((value) => (
										<TabsTrigger key={value} value={value}>
											{t(`codes.invoices.${value}`)}
											<span className="tabular-nums opacity-60">
												{number.format(withStatus(value).length)}
											</span>
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
						}
					/>
				</CardContent>
			</Card>
			<InvoiceDialog
				invoice={invoices.find((invoice) => invoice.id === openId) ?? null}
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function InvoicesPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72" />
			</div>
			<Skeleton className="h-20 rounded-surface" />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-md" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list when the loader fails. Try again runs the loader again. */
export function InvoicesPageError() {
	const { t } = useT();
	return <PageError message={t("invoices.loadError")} />;
}
