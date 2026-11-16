// The table of the other entries with the same party, on the detail page of one entry.
// TransactionDetailPage renders it with the newest rows that buildTransactionDetail returns.
import { Link } from "@tanstack/react-router";
import {
	dayToDate,
	findCard,
	MoneyText,
	type Transaction,
	TransactionStatusBadge,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

type HistoryTableProps = {
	/** Earlier entries with the same party, newest first. */
	rows: Transaction[];
	/** The "Nov 13" formatter of the page. */
	shortDay: Intl.DateTimeFormat;
};

/** The description links to the detail page of that entry. Under 48rem the status column hides. */
export function HistoryTable({ rows, shortDay }: HistoryTableProps) {
	const { t } = useT();
	// The memo of a card payment only says "Card ending 4417", so a card row names the group and the holder.
	const describe = (row: Transaction) => {
		const card = row.cardId ? findCard(row.cardId) : undefined;
		return card
			? `${t(`categories.${row.category}`)} · ${card.holderName}`
			: row.memo;
	};
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t("transactions.date")}</TableHead>
					<TableHead>{t("transactions.description")}</TableHead>
					<TableHead className="max-md:hidden">
						{t("transactions.status")}
					</TableHead>
					<TableHead className="text-end">{t("transactions.amount")}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => (
					<TableRow key={row.id}>
						<TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
							{shortDay.format(dayToDate(row.day))}
						</TableCell>
						{/* The description wraps, so the amount stays in view on a phone. */}
						<TableCell className="whitespace-normal">
							<Link
								to="/app/transactions/$transactionId"
								params={{ transactionId: row.id }}
								className="hover:underline"
							>
								<bdi>{describe(row)}</bdi>
							</Link>
						</TableCell>
						<TableCell className="max-md:hidden">
							<TransactionStatusBadge status={row.status} />
						</TableCell>
						<TableCell className="text-end">
							<MoneyText amountCents={row.amountCents} isSigned />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
