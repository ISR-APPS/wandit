// Every invoice of one matter in a RecordTable: the number, the dates, the amount, the balance, and the status.
// MatterDetailPage renders it in the "Invoices" tab. The row menu opens the invoice dialog of the billing page.
import { Link } from "@tanstack/react-router";
import {
	copyToClipboard,
	type InvoiceRow,
	InvoiceStatusBadge,
	moneyFormat,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

// A list page shows twenty rows, as the kit list pages do.
const INVOICES_PAGE_SIZE = 20;

type MatterInvoicesTableProps = {
	/** Newest first. */
	invoices: InvoiceRow[];
};

/** The number cell links to the invoice dialog, as the "Open" item of the row menu does. */
export function MatterInvoicesTable({ invoices }: MatterInvoicesTableProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const columns: RecordColumn<InvoiceRow>[] = [
		{
			id: "number",
			header: t("billing.invoice"),
			sortValue: (invoice) => invoice.number,
			cell: (invoice) => (
				<Link
					to="/app/billing"
					search={{ invoice: invoice.id }}
					className="font-medium tabular-nums hover:underline"
				>
					{invoice.number}
				</Link>
			),
		},
		{
			id: "issued",
			header: t("billing.issued"),
			hideable: true,
			sortValue: (invoice) => invoice.issuedAt,
			cell: (invoice) => (
				<span className="tabular-nums">
					{date.format(new Date(invoice.issuedAt))}
				</span>
			),
		},
		{
			id: "due",
			header: t("billing.due"),
			hideable: true,
			sortValue: (invoice) => invoice.dueAt,
			cell: (invoice) => (
				<span className="tabular-nums">
					{date.format(new Date(invoice.dueAt))}
				</span>
			),
		},
		{
			id: "amount",
			header: t("billing.amount"),
			align: "end",
			sortValue: (invoice) => invoice.amount,
			cell: (invoice) => money.format(invoice.amount),
		},
		{
			id: "balance",
			header: t("billing.balance"),
			align: "end",
			hideable: true,
			sortValue: (invoice) => invoice.amount - invoice.paidAmount,
			cell: (invoice) => money.format(invoice.amount - invoice.paidAmount),
		},
		{
			id: "status",
			header: t("billing.status"),
			hideable: true,
			sortValue: (invoice) => invoice.status,
			cell: (invoice) => <InvoiceStatusBadge status={invoice.status} />,
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("matters.invoices")}</CardTitle>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={invoices}
					columns={columns}
					searchText={(invoice) => invoice.number}
					searchPlaceholder={t("billing.filter")}
					pageSize={INVOICES_PAGE_SIZE}
					noResults={t("matters.noInvoices")}
					rowMenu={(invoice) => (
						<>
							<DropdownMenuItem asChild>
								<Link to="/app/billing" search={{ invoice: invoice.id }}>
									{t("table.open")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(invoice.number, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("billing.copyNumber")}
							</DropdownMenuItem>
						</>
					)}
				/>
			</CardContent>
		</Card>
	);
}
