// The Reports tab of the home: one line per visit done in the period, with its fee, its payer, and its payment state.
// DashboardPage renders it in the Reports tab with the invoices of the summary of the chosen period.
// A payment filter cuts the rows; RecordTable then filters, sorts, selects, and pages them.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	moneyFormat,
	PAYMENT_STATUS_BADGE,
	PAYMENT_STATUSES,
	type PaymentStatus,
	toCsv,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import type { InvoiceRow } from "../lib/summary";

type ReportsTableProps = {
	/** The visits done in the period, newest first. */
	invoices: InvoiceRow[];
};

/** "Export selected" downloads the chosen lines as CSV with the amounts in plain numbers. */
export function ReportsTable({ invoices }: ReportsTableProps) {
	const { t, locale } = useT();
	const [status, setStatus] = useState<PaymentStatus | null>(null);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const money = moneyFormat(locale);
	const rows =
		status === null
			? invoices
			: invoices.filter((row) => row.status === status);

	const columns: RecordColumn<InvoiceRow>[] = [
		{
			id: "date",
			header: t("reports.date"),
			sortValue: (row) => row.at,
			cell: (row) => (
				<span className="tabular-nums">{date.format(row.at)}</span>
			),
		},
		{
			id: "patient",
			header: t("reports.patient"),
			sortValue: (row) => row.patientName,
			cell: (row) => (
				<Link
					to="/app/patients/$patientId"
					params={{ patientId: row.patientId }}
					className="font-medium hover:underline"
					dir="auto"
				>
					{row.patientName}
				</Link>
			),
		},
		{
			id: "department",
			header: t("reports.department"),
			hideable: true,
			sortValue: (row) => t(`specialties.${row.specialty}`),
			cell: (row) => t(`specialties.${row.specialty}`),
		},
		{
			id: "visit",
			header: t("reports.visit"),
			hideable: true,
			sortValue: (row) => t(`visitTypes.${row.visitType}`),
			cell: (row) => t(`visitTypes.${row.visitType}`),
		},
		{
			id: "amount",
			header: t("reports.amount"),
			align: "end",
			sortValue: (row) => row.amount,
			cell: (row) => money.format(row.amount),
		},
		{
			id: "payer",
			header: t("reports.payer"),
			hideable: true,
			sortValue: (row) => t(`coverage.${row.payer}`),
			cell: (row) => t(`coverage.${row.payer}`),
		},
		{
			id: "status",
			header: t("reports.status"),
			sortValue: (row) => PAYMENT_STATUSES.indexOf(row.status),
			cell: (row) => (
				<Badge variant={PAYMENT_STATUS_BADGE[row.status]}>
					{t(`paymentStatuses.${row.status}`)}
				</Badge>
			),
		},
	];

	const csvColumns: CsvColumn<InvoiceRow>[] = [
		{ header: t("reports.date"), value: (row) => date.format(row.at) },
		{ header: t("reports.patient"), value: (row) => row.patientName },
		{
			header: t("reports.department"),
			value: (row) => t(`specialties.${row.specialty}`),
		},
		{
			header: t("reports.visit"),
			value: (row) => t(`visitTypes.${row.visitType}`),
		},
		{ header: t("reports.amount"), value: (row) => String(row.amount) },
		{ header: t("reports.payer"), value: (row) => t(`coverage.${row.payer}`) },
		{
			header: t("reports.status"),
			value: (row) => t(`paymentStatuses.${row.status}`),
		},
	];

	return (
		<RecordTable
			rows={rows}
			columns={columns}
			searchText={(row) =>
				`${row.patientName} ${t(`specialties.${row.specialty}`)} ${t(`visitTypes.${row.visitType}`)}`
			}
			searchPlaceholder={t("reports.filter")}
			toolbar={
				<RecordFilter
					label={t("reports.status")}
					options={PAYMENT_STATUSES.map((value) => ({
						value,
						label: t(`paymentStatuses.${value}`),
					}))}
					value={status}
					onValueChange={(value) =>
						setStatus(
							PAYMENT_STATUSES.find((option) => option === value) ?? null,
						)
					}
				/>
			}
			rowMenu={(row) => (
				<>
					<DropdownMenuItem asChild>
						<Link to="/app/appointments" search={{ appointment: row.id }}>
							{t("dashboard.openAppointment")}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							copyToClipboard(row.id, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						{t("table.copyId")}
					</DropdownMenuItem>
				</>
			)}
			selectable
			bulkActions={(selectedRows) => (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() =>
						downloadCsv("visit-payments.csv", toCsv(selectedRows, csvColumns))
					}
				>
					<DownloadSimpleIcon />
					{t("table.exportSelected")}
				</Button>
			)}
			pageSize={10}
			noResults={t("reports.noResults")}
		/>
	);
}
