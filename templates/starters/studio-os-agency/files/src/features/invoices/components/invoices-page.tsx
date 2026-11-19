// The invoice list behind login, on the anatomy of the kit transactions page: a header with the period
// and a download button, the tabs Latest and Upcoming, and one card of rows (day, invoice and status, amount, open).
// The /app/invoices route renders it after its loader, and also uses the skeleton and the error below.
// The open button of a row opens the invoice dialog with its lines. Each tab shows 20 rows per page.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	downloadCsv,
	fillMessage,
	type InvoiceRow,
	isInLastDays,
	PageError,
	type PeriodDays,
	PeriodSelect,
	toCsv,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { invoicesQueryOptions } from "../api/invoices.queries";
import { invoiceCsvColumns } from "../lib/invoice-csv";
import { InvoiceDialog } from "./invoice-dialog";

// Rows per page, as on the other list pages.
const PAGE_SIZE = 20;

// The page opens on three months, so the Latest tab holds more than one payment cycle.
const DEFAULT_INVOICE_DAYS: PeriodDays = 90;

/** The color of each amount: green when paid, red when overdue, plain otherwise. The status word shows too. */
const AMOUNT_CLASS = {
	draft: "text-muted-foreground",
	sent: "text-foreground",
	overdue: "text-destructive",
	paid: "text-success",
} satisfies Record<InvoiceRow["status"], string>;

/** Latest: invoices sent in the period, the newest first. Upcoming: the drafts, the next issue day first. */
export function InvoicesPage() {
	const { t } = useT();
	const { data: invoices } = useSuspenseQuery(invoicesQueryOptions());
	const [days, setDays] = useState<PeriodDays>(DEFAULT_INVOICE_DAYS);
	const [tab, setTab] = useState("latest");
	// The dialog keeps the last invoice while it fades out, so it never closes empty.
	const [openId, setOpenId] = useState<string | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const latest = invoices
		.filter(
			(invoice) =>
				invoice.status !== "draft" && isInLastDays(invoice.issueDay, days),
		)
		.sort((first, second) => second.issueDay.localeCompare(first.issueDay));
	const upcoming = invoices
		.filter((invoice) => invoice.status === "draft")
		.sort((first, second) => first.issueDay.localeCompare(second.issueDay));

	function openInvoice(invoiceId: string) {
		setOpenId(invoiceId);
		setIsDialogOpen(true);
	}

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("invoices.title")}
				description={t("invoices.description")}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							size="icon"
							aria-label={t("invoices.export")}
							onClick={() =>
								downloadCsv(
									"invoices.csv",
									toCsv(
										tab === "latest" ? latest : upcoming,
										invoiceCsvColumns(t),
									),
								)
							}
						>
							<DownloadSimpleIcon />
						</Button>
					</>
				}
			/>
			<Tabs value={tab} onValueChange={setTab} className="gap-4">
				<TabsList>
					<TabsTrigger value="latest">{t("invoices.tabs.latest")}</TabsTrigger>
					<TabsTrigger value="upcoming">
						{t("invoices.tabs.upcoming")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="latest">
					<InvoiceList
						rows={latest}
						empty={t("invoices.emptyLatest")}
						onOpen={openInvoice}
					/>
				</TabsContent>
				<TabsContent value="upcoming">
					<InvoiceList
						rows={upcoming}
						empty={t("invoices.emptyUpcoming")}
						onOpen={openInvoice}
					/>
				</TabsContent>
			</Tabs>
			<InvoiceDialog
				invoice={invoices.find((invoice) => invoice.id === openId) ?? null}
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
			/>
		</div>
	);
}

type InvoiceListProps = {
	rows: InvoiceRow[];
	/** The sentence of an empty tab. */
	empty: string;
	/** Opens the dialog of one invoice. */
	onOpen: (invoiceId: string) => void;
};

/** One card with a row per invoice, then the range and the Previous and Next buttons. */
function InvoiceList({ rows, empty, onOpen }: InvoiceListProps) {
	const { t, locale } = useT();
	const { longDate, money } = useFormatters();
	const [page, setPage] = useState(1);
	if (rows.length === 0) {
		return <p className="text-muted-foreground text-sm">{empty}</p>;
	}
	const number = new Intl.NumberFormat(locale);
	const pageCount = Math.ceil(rows.length / PAGE_SIZE);
	// A shorter period can shrink the list below the current page, so clamp here.
	const currentPage = Math.min(page, pageCount);
	const firstIndex = (currentPage - 1) * PAGE_SIZE;
	const pageRows = rows.slice(firstIndex, firstIndex + PAGE_SIZE);
	return (
		<Card className="gap-0 py-0">
			<ul className="divide-y">
				{pageRows.map((invoice) => (
					<li
						key={invoice.id}
						className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 py-3"
					>
						{/* Below sm the date takes its own line, so the client and the status keep the full width. */}
						<span className="basis-full text-sm tabular-nums sm:w-28 sm:shrink-0 sm:basis-auto">
							{longDate(invoice.issueDay)}
						</span>
						<span className="grid min-w-0 flex-1">
							<span className="truncate text-sm">
								{`${invoice.number ?? t("invoices.draftNumber")} · ${invoice.clientName}`}
							</span>
							<span className="truncate text-muted-foreground text-sm">
								{`${t(`codes.invoices.${invoice.status}`)} · ${invoice.projectName}`}
							</span>
						</span>
						<span
							className={cn(
								"ms-auto text-sm tabular-nums",
								AMOUNT_CLASS[invoice.status],
							)}
						>
							{money(invoice.amount)}
						</span>
						<Button
							variant="outline"
							size="icon"
							className="size-8"
							aria-label={t("invoices.open")}
							onClick={() => onOpen(invoice.id)}
						>
							<CaretRightIcon className="rtl:rotate-180" />
						</Button>
					</li>
				))}
			</ul>
			<div className="flex items-center gap-2 border-t px-6 py-3">
				<p className="flex-1 text-muted-foreground text-sm tabular-nums">
					{fillMessage(t("table.range"), {
						from: number.format(firstIndex + 1),
						to: number.format(firstIndex + pageRows.length),
						count: number.format(rows.length),
					})}
				</p>
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage === 1}
					onClick={() => setPage(currentPage - 1)}
				>
					{t("table.previous")}
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage === pageCount}
					onClick={() => setPage(currentPage + 1)}
				>
					{t("table.next")}
				</Button>
			</div>
		</Card>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f", "g"];

/** Placeholder while the loader runs: the header, the tabs, and seven rows. */
export function InvoicesPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-48" />
			</div>
			<Skeleton className="h-9 w-48" />
			<div className="grid gap-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-14" />
				))}
			</div>
		</div>
	);
}

/** Error state of the Invoices page when the loader fails. Try again runs the loader again. */
export function InvoicesPageError() {
	const { t } = useT();
	return <PageError message={t("invoices.loadError")} />;
}
