// The payee card of the transaction page, in the kit history table form: the note, the status, and the day
// of the newest other entries with the same payee. TransactionDetailPage renders it under the status card.
// Each note opens its entry. The "Payee history" tab of the page lists every entry.
import { Link } from "@tanstack/react-router";
import {
	dayFormat,
	dayToDate,
	fillMessage,
	TransactionStatusBadge,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { TransactionRow } from "../api/transactions.queries";

// The card shows this many rows: the density of the kit history card.
const SHOWN_ROWS = 6;

type PayeeHistoryCardProps = {
	/** The payee of the open entry. For a transfer: the other account. */
	payee: string;
	/** The other entries with the same payee, newest first. The card shows the first 6. */
	rows: TransactionRow[];
};

/** No other entry: one muted sentence. */
export function PayeeHistoryCard({ payee, rows }: PayeeHistoryCardProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{fillMessage(t("transactions.payeeHistory"), { payee })}
				</CardTitle>
				{rows.length === 0 ? (
					<CardDescription>
						{t("transactions.payeeHistoryEmpty")}
					</CardDescription>
				) : null}
			</CardHeader>
			{rows.length === 0 ? null : (
				<CardContent>
					<Table>
						<TableHeader className="bg-transparent">
							<TableRow>
								<TableHead>{t("transactions.memo")}</TableHead>
								<TableHead>{t("transactions.status")}</TableHead>
								<TableHead className="text-end">
									{t("transactions.date")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.slice(0, SHOWN_ROWS).map((row) => (
								<TableRow key={row.id}>
									<TableCell className="max-w-40 truncate">
										<Link
											to="/app/transactions/$transactionId"
											params={{ transactionId: row.id }}
											className="hover:underline"
											dir="auto"
										>
											{row.memo}
										</Link>
									</TableCell>
									<TableCell>
										<TransactionStatusBadge status={row.status} />
									</TableCell>
									<TableCell className="whitespace-nowrap text-end tabular-nums">
										{day.format(dayToDate(row.day))}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			)}
		</Card>
	);
}
