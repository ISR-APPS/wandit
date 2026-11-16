// Every payment of one card in a searchable table, with the shared entry columns.
// CardDetailPage renders it last, at the full width of the page.
import { useTransactionColumns } from "~/features/transactions";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable } from "~/shared/ui/data-table";
import type { CardDetail } from "../lib/card-spend";

type DetailCardProps = {
	/** The card, its payments, and its top merchants, from cardDetailQueryOptions. */
	detail: CardDetail;
};

/** Every payment of the card, with the shared entry columns. */
export function CardPaymentsCard({ detail }: DetailCardProps) {
	const { t } = useT();
	const { columns, searchText } = useTransactionColumns(
		detail.transactions,
		"card",
	);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("cards.paymentsTitle")}</CardTitle>
				<CardDescription>{t("cards.paymentsDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="max-md:px-3">
				{detail.transactions.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("cards.noPayments")}
					</p>
				) : (
					<DataTable
						rows={detail.transactions}
						columns={columns}
						searchText={searchText}
						noResults={t("transactions.noResults")}
					/>
				)}
			</CardContent>
		</Card>
	);
}
