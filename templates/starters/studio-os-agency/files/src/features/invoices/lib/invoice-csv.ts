// The CSV columns of an invoice export: number, client, project, days, status, and amount.
// The home export menu and the Invoices page call it with the translations.
import type { CsvColumn, InvoiceRow, Translate } from "~/features/studio";

/** Days stay in ISO dates and amounts in whole euros, so a spreadsheet can sort and sum them. */
export function invoiceCsvColumns(t: Translate): CsvColumn<InvoiceRow>[] {
	return [
		{
			header: t("invoices.invoice"),
			value: (row) => row.number ?? t("invoices.draftNumber"),
		},
		{ header: t("invoices.client"), value: (row) => row.clientName },
		{ header: t("invoices.project"), value: (row) => row.projectName },
		{ header: t("invoices.issued"), value: (row) => row.issueDay },
		{ header: t("invoices.due"), value: (row) => row.dueDay },
		{ header: t("invoices.paid"), value: (row) => row.paidDay ?? "" },
		{
			header: t("invoices.status"),
			value: (row) => t(`codes.invoices.${row.status}`),
		},
		{ header: t("invoices.amount"), value: (row) => String(row.amount) },
	];
}
