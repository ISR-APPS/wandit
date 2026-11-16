// The one column list of the transaction table: date, payee, category with account, status, and amount.
// The home, the list page, and the account page pass it to DataTable. No page writes a second list.
// The amount column draws its bar against the largest amount of the rows that it gets.
import { Link } from "@tanstack/react-router";
import {
	dayFormat,
	dayToDate,
	TRANSACTION_STATUSES,
	TransactionStatusBadge,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import type { DataTableColumn } from "~/shared/ui/data-table";
import { useSidebar } from "~/shared/ui/sidebar";
import type { TransactionRow } from "../api/transactions.queries";
import { AmountCell } from "../components/amount-cell";

/** What DataTable needs to show transactions. */
type TransactionTable = {
	columns: DataTableColumn<TransactionRow>[];
	/** The text that the search box matches: the payee, the note, the category, the account, and the entry number. */
	searchText: (row: TransactionRow) => string;
};

/**
 * The columns and the search text for `rows`. Pass the same rows that the table gets:
 * each bar is a share of the largest amount of `rows`. The payee cell opens the detail page of the row.
 * `categoryNote` picks the small line under the category: the account name, or the payment method
 * on the page of one account, where every row has the same account.
 */
export function useTransactionTable(
	rows: TransactionRow[],
	categoryNote: "account" | "method" = "account",
): TransactionTable {
	const { t, locale } = useT();
	// The sidebar of the app shell already reads the phone media query. Every /app page sits inside it.
	const { isMobile: isPhone } = useSidebar();
	const day = dayFormat(locale);
	const largestCents = rows.reduce(
		(largest, row) => Math.max(largest, Math.abs(row.amountCents)),
		0,
	);

	const dateColumn: DataTableColumn<TransactionRow> = {
		id: "date",
		header: t("transactions.date"),
		// The id starts with the day and ends with the rank in the day, so it sorts in ledger order.
		sortValue: (row) => row.id,
		cell: (row) => (
			<span className="whitespace-nowrap text-muted-foreground tabular-nums">
				{day.format(dayToDate(row.day))}
			</span>
		),
	};
	const payeeColumn: DataTableColumn<TransactionRow> = {
		id: "payee",
		header: t("transactions.payee"),
		sortValue: (row) => row.payee,
		// The link holds both lines, so its touch area is 44 px high. The negative margin keeps the row height.
		// justify-items-start: each line is as wide as its text. Then dir="auto" text sits at the start side in Arabic too.
		cell: (row) => (
			<Link
				to="/app/transactions/$transactionId"
				params={{ transactionId: row.id }}
				className="group -my-1.5 grid min-w-44 justify-items-start py-1.5 max-md:w-36 max-md:min-w-0"
			>
				{/* On a phone a long line ends with an ellipsis, so the amount stays on the screen. */}
				<span
					className="max-w-full truncate font-medium group-hover:underline"
					dir="auto"
				>
					{row.payee}
				</span>
				<span
					className="max-w-full truncate text-muted-foreground text-xs"
					dir="auto"
				>
					{row.memo}
				</span>
			</Link>
		),
	};
	const categoryColumn: DataTableColumn<TransactionRow> = {
		id: "category",
		header: t("transactions.category"),
		sortValue: (row) => t(`categories.${row.categoryId}`),
		cell: (row) => (
			<div className="grid justify-items-start whitespace-nowrap">
				<span>{t(`categories.${row.categoryId}`)}</span>
				<bdi className="text-muted-foreground text-xs">
					{categoryNote === "account"
						? row.accountName
						: t(`paymentMethods.${row.method}`)}
				</bdi>
			</div>
		),
	};
	const statusColumn: DataTableColumn<TransactionRow> = {
		id: "status",
		header: t("transactions.status"),
		sortValue: (row) => TRANSACTION_STATUSES.indexOf(row.status),
		cell: (row) => <TransactionStatusBadge status={row.status} />,
	};
	const amountColumn: DataTableColumn<TransactionRow> = {
		id: "amount",
		header: t("transactions.amount"),
		align: "end",
		sortValue: (row) => row.amountCents,
		cell: (row) => (
			<AmountCell
				amountCents={row.amountCents}
				type={row.type}
				largestCents={largestCents}
			/>
		),
	};

	return {
		searchText: (row) =>
			`${row.payee} ${row.memo} ${t(`categories.${row.categoryId}`)} ${row.accountName} ${row.id}`,
		// A phone shows about three columns before the table scrolls sideways, so the amount moves next to the payee.
		columns: isPhone
			? [dateColumn, payeeColumn, amountColumn, categoryColumn, statusColumn]
			: [dateColumn, payeeColumn, categoryColumn, statusColumn, amountColumn],
	};
}
