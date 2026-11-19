// The transaction history card of the asset page: a small table of the 6 newest transactions of the asset,
// with the type and units, the status badge, and the date. Each type cell opens the side panel of Activity.
// AssetDetailPage renders it in the 2-card row of the Overview tab. The Transactions tab lists every row.
import { Link } from "@tanstack/react-router";
import type { Transaction } from "~/features/activity";
import {
	fillMessage,
	formatQuantity,
	TRANSACTION_STATUS_BADGE,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

// 6 rows keep the card as high as the card beside it.
const SHOWN_ROWS = 6;

type AssetTransactionsCardProps = {
	/** The ticker of the asset, for the empty sentence. */
	symbol: string;
	/** The transactions of the asset, newest first, from assetTransactionsQueryOptions(). */
	transactions: Transaction[];
};

/** An asset with no transaction shows one sentence instead of the table. */
export function AssetTransactionsCard({
	symbol,
	transactions,
}: AssetTransactionsCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "short" });

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("asset.transactionsTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				{transactions.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{fillMessage(t("asset.noTransactions"), { symbol })}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("activity.type")}</TableHead>
								<TableHead>{t("activity.status")}</TableHead>
								<TableHead className="text-end">{t("activity.date")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{transactions.slice(0, SHOWN_ROWS).map((transaction) => (
								<TableRow key={transaction.id}>
									<TableCell>
										<Link
											to="/app/activity"
											search={{ tx: transaction.id }}
											className="hover:underline"
										>
											{`${t(`ledger.types.${transaction.type}`)} ${formatQuantity(transaction.quantity, locale)} ${transaction.assetSymbol}`}
										</Link>
									</TableCell>
									<TableCell>
										<Badge
											variant={TRANSACTION_STATUS_BADGE[transaction.status]}
										>
											{t(`ledger.statuses.${transaction.status}`)}
										</Badge>
									</TableCell>
									<TableCell className="text-end text-muted-foreground tabular-nums">
										{date.format(new Date(transaction.occurredAt))}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
