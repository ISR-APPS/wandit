// The one column list of every entry table: the home, the transactions page, a card, and a payee.
// The pages pass their rows. The hook returns the DataTable columns and the search text.
// The amount cell draws a bar against the largest amount of the rows, as the home "ledger" asks.
import { Link } from "@tanstack/react-router";
import {
	accountOf,
	dayFormat,
	dayToDate,
	MoneyText,
	type Transaction,
	TransactionStatusBadge,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { DataTableColumn } from "~/shared/ui/data-table";
import { useSidebar } from "~/shared/ui/sidebar";

/**
 * Which rows the table shows. "card": the payments of one card, so the memo "Card ending 4417" and the account repeat.
 * "payee": the payments to one payee, so the name repeats and the memo leads.
 */
type TransactionScope = "all" | "card" | "payee";

/** The columns and the search text of DataTable. */
type TransactionColumns = {
	columns: DataTableColumn<Transaction>[];
	searchText: (row: Transaction) => string;
};

/**
 * Under 48rem the table keeps two columns: the entry with its date, and the amount.
 * `scope` drops the text that every row of a card or payee page repeats.
 */
export function useTransactionColumns(
	rows: Transaction[],
	scope: TransactionScope = "all",
): TransactionColumns {
	const { t, locale } = useT();
	const { isMobile: isPhone } = useSidebar();
	const day = dayFormat(locale);
	const largestCents = rows.reduce(
		(largest, row) => Math.max(largest, Math.abs(row.amountCents)),
		0,
	);

	// The second line of an entry. A phone has no date and no status column, so the line carries them.
	// Posted is the normal state, so only pending and returned show their word there.
	const detailLine = (row: Transaction) => {
		const category = t(`categories.${row.category}`);
		const method = t(`methods.${row.method}`);
		if (!isPhone) {
			return scope === "card"
				? category
				: `${category} · ${scope === "payee" ? method : row.memo}`;
		}
		const parts = [
			day.format(dayToDate(row.day)),
			scope === "card" ? category : method,
		];
		if (row.status !== "posted") {
			parts.push(t(`statuses.${row.status}`));
		}
		return parts.join(" · ");
	};

	const describe = (row: Transaction) => (
		// justify-items-start: each line is as wide as its text, so dir="auto" text keeps the start side.
		<div className="grid min-w-0 justify-items-start">
			<Link
				to="/app/transactions/$transactionId"
				params={{ transactionId: row.id }}
				className="max-w-full truncate font-medium hover:underline"
				dir="auto"
			>
				{scope === "payee" ? row.memo : row.counterparty}
			</Link>
			<span className="max-w-full truncate text-muted-foreground text-xs">
				{detailLine(row)}
			</span>
		</div>
	);

	const amount = (row: Transaction) => {
		const share =
			largestCents > 0 ? (Math.abs(row.amountCents) / largestCents) * 100 : 0;
		return (
			<div className="flex items-center justify-end gap-3">
				{/* The bar repeats the number, so screen readers skip it. A narrow main column hides it to keep room for the text. */}
				{isPhone ? null : (
					<span
						aria-hidden="true"
						className="@max-4xl/main:hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted"
					>
						<span
							className={cn(
								"block h-full rounded-full",
								row.amountCents > 0 ? "bg-success/70" : "bg-chart-1/45",
							)}
							style={{ width: `${Math.max(share, 2)}%` }}
						/>
					</span>
				)}
				{/* A fixed width keeps every bar at the same place, whatever the length of the amount. */}
				<MoneyText
					amountCents={row.amountCents}
					isSigned
					className={cn(
						"inline-block min-w-26 text-end",
						row.status === "returned" && "line-through",
					)}
				/>
			</div>
		);
	};

	const dateColumn: DataTableColumn<Transaction> = {
		id: "date",
		header: t("transactions.date"),
		sortValue: (row) => row.id,
		cell: (row) => (
			<span className="whitespace-nowrap text-muted-foreground tabular-nums">
				{day.format(dayToDate(row.day))}
			</span>
		),
	};
	const descriptionColumn: DataTableColumn<Transaction> = {
		id: "description",
		header: t("transactions.description"),
		sortValue: (row) => row.counterparty,
		cell: describe,
	};
	const amountColumn: DataTableColumn<Transaction> = {
		id: "amount",
		header: t("transactions.amount"),
		align: "end",
		sortValue: (row) => row.amountCents,
		cell: amount,
	};

	const accountColumn: DataTableColumn<Transaction> = {
		id: "account",
		header: t("transactions.account"),
		sortValue: (row) => row.accountId,
		// Most entries book on the operating account. Only the other accounts show their name, so they stand out.
		cell: (row) => (
			<span className="whitespace-nowrap">
				{row.accountId === "operating" ? null : (
					<span className="me-1.5">{t(`accounts.${row.accountId}`)}</span>
				)}
				<span className="text-muted-foreground tabular-nums">
					{`••${accountOf(row.accountId).numberEnding}`}
				</span>
			</span>
		),
	};
	const statusColumn: DataTableColumn<Transaction> = {
		id: "status",
		header: t("transactions.status"),
		sortValue: (row) => row.status,
		cell: (row) => <TransactionStatusBadge status={row.status} />,
	};

	// A card or payee page shows the paying account in its facts, and its table sits in a 2/3 column.
	const columns = isPhone
		? [descriptionColumn, amountColumn]
		: scope === "all"
			? [
					dateColumn,
					descriptionColumn,
					accountColumn,
					statusColumn,
					amountColumn,
				]
			: [dateColumn, descriptionColumn, statusColumn, amountColumn];

	return {
		columns,
		searchText: (row) =>
			`${row.counterparty} ${row.memo} ${t(`methods.${row.method}`)} ${t(`categories.${row.category}`)}`,
	};
}
