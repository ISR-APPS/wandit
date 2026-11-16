// The invoice table of the billing page: status tabs with counts, a search, and one row per invoice.
// BillingPage renders it under the charts. A click on an invoice number opens its dialog through ?invoice=.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	formatRelativeTime,
	INVOICE_STATUSES,
	type InvoiceStatus,
	InvoiceStatusBadge,
	moneyFormat,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { invoicesQueryOptions } from "../api/billing.queries";
import type { InvoiceListItem } from "../lib/billing";

/** The status tab filters the rows; then DataTable searches, sorts, and pages them. */
export function InvoicesCard() {
	const { t, locale } = useT();
	const { data: invoices } = useSuspenseQuery(invoicesQueryOptions());
	const [status, setStatus] = useState<InvoiceStatus | "all">("all");
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const now = Date.now();
	// A tab shows only for a status that has rows.
	const tabs = INVOICE_STATUSES.map((value) => ({
		value,
		count: invoices.filter((invoice) => invoice.status === value).length,
	})).filter((tab) => tab.count > 0);
	const rows =
		status === "all"
			? invoices
			: invoices.filter((invoice) => invoice.status === status);

	const columns: DataTableColumn<InvoiceListItem>[] = [
		{
			id: "number",
			header: t("billing.invoice"),
			sortValue: (row) => row.number,
			cell: (row) => (
				<div className="grid justify-items-start gap-1">
					<Link
						to="/app/billing"
						search={{ invoice: row.id }}
						className="whitespace-nowrap font-medium tabular-nums hover:underline"
					>
						{row.number}
					</Link>
					{/* On a phone the balance and status columns are off screen, so they also show here. */}
					<span className="flex @2xl/main:hidden items-center gap-2">
						<InvoiceStatusBadge status={row.status} />
						{row.amount > row.paidAmount ? (
							<span className="text-xs tabular-nums">
								{money.format(row.amount - row.paidAmount)}
							</span>
						) : null}
					</span>
				</div>
			),
		},
		{
			id: "client",
			header: t("billing.client"),
			sortValue: (row) => row.clientName,
			cell: (row) => (
				<div className="grid min-w-48 justify-items-start">
					<span className="font-medium" dir="auto">
						{row.clientName}
					</span>
					<span className="text-muted-foreground text-xs" dir="auto">
						{row.matterName}
					</span>
				</div>
			),
		},
		{
			id: "issued",
			header: t("billing.issued"),
			sortValue: (row) => row.issuedAt,
			cell: (row) => (
				<span className="whitespace-nowrap tabular-nums">
					{date.format(new Date(row.issuedAt))}
				</span>
			),
		},
		{
			id: "due",
			header: t("billing.due"),
			sortValue: (row) => row.dueAt,
			// Every row shows the date. An open invoice adds the time left or the delay under it.
			cell: (row) => (
				<span className="grid whitespace-nowrap">
					<span className="tabular-nums">
						{date.format(new Date(row.dueAt))}
					</span>
					{row.status === "paid" ? null : (
						<span
							className={
								row.status === "overdue"
									? "font-medium text-destructive text-xs"
									: "text-muted-foreground text-xs"
							}
						>
							{formatRelativeTime(row.dueAt, now, locale)}
						</span>
					)}
				</span>
			),
		},
		{
			id: "amount",
			header: t("billing.amount"),
			align: "end",
			sortValue: (row) => row.amount,
			cell: (row) => money.format(row.amount),
		},
		{
			id: "balance",
			header: t("billing.balance"),
			align: "end",
			sortValue: (row) => row.amount - row.paidAmount,
			cell: (row) =>
				row.amount === row.paidAmount ? (
					<span className="text-muted-foreground">{money.format(0)}</span>
				) : (
					money.format(row.amount - row.paidAmount)
				),
		},
		{
			id: "status",
			header: t("billing.status"),
			sortValue: (row) => INVOICE_STATUSES.indexOf(row.status),
			cell: (row) => <InvoiceStatusBadge status={row.status} />,
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("billing.invoices")}</CardTitle>
			</CardHeader>
			<CardContent>
				<DataTable
					key={status}
					rows={rows}
					columns={columns}
					searchText={(row) =>
						`${row.number} ${row.clientName} ${row.matterName} ${row.matterNumber}`
					}
					noResults={t("billing.noResults")}
					toolbar={
						<Tabs
							value={status}
							onValueChange={(value) =>
								setStatus(
									INVOICE_STATUSES.find((option) => option === value) ?? "all",
								)
							}
							className="max-w-full overflow-x-auto"
						>
							<TabsList>
								<TabsTrigger value="all">
									{t("billing.all")}
									<span className="text-muted-foreground tabular-nums">
										{number.format(invoices.length)}
									</span>
								</TabsTrigger>
								{tabs.map((tab) => (
									<TabsTrigger key={tab.value} value={tab.value}>
										{t(`invoiceStatus.${tab.value}`)}
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
	);
}
