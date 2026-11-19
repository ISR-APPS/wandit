// The third card of the transaction page, in the kit tag card form: the labels of the entry as outline badges.
// TransactionDetailPage renders it under the month card. A filter link opens the list of the same category.
import { Link } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { TransactionRow } from "../api/transactions.queries";

type EntryLabelsCardProps = {
	transaction: TransactionRow;
};

/** The category badge is a link to the transactions of the same type and category. */
export function EntryLabelsCard({ transaction }: EntryLabelsCardProps) {
	const { t } = useT();
	const labels = [
		t(`transactionTypes.${transaction.type}`),
		t(`transactionStatuses.${transaction.status}`),
		t(`paymentMethods.${transaction.method}`),
		transaction.accountName,
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("transactions.labels")}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-2">
				<Badge asChild variant="outline">
					<Link
						to="/app/transactions"
						search={{
							type: transaction.type,
							category: transaction.categoryId,
						}}
					>
						{t(`categories.${transaction.categoryId}`)}
					</Link>
				</Badge>
				{labels.map((label) => (
					<Badge key={label} variant="outline">
						{label}
					</Badge>
				))}
			</CardContent>
		</Card>
	);
}
