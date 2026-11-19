// The history card of the account page, in the kit history table form: the payee, the status, and the day
// of the newest entries of the account. AccountDetailPage renders it under the activity card.
import { Link } from "@tanstack/react-router";
import {
	dayFormat,
	dayToDate,
	TransactionStatusBadge,
} from "~/features/ledger";
import type { TransactionRow } from "~/features/transactions";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

// The card shows this many rows: the density of the kit history card.
const SHOWN_ROWS = 6;

type AccountHistoryCardProps = {
	/** Every entry of the account, newest first. The card shows the first 6. */
	rows: TransactionRow[];
};

/** Each payee opens its entry. The activity card says when the account has no entry. */
export function AccountHistoryCard({ rows }: AccountHistoryCardProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.historyTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader className="bg-transparent">
						<TableRow>
							<TableHead>{t("transactions.payee")}</TableHead>
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
										{row.payee}
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
		</Card>
	);
}
