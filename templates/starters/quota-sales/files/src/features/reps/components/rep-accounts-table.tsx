// The Accounts tab of the rep page: every account that the rep owns, with its orders and bookings of the quarter.
// RepDetailPage renders it when the Accounts tab is open. An account with no order this quarter shows 0.
import { fillMessage, moneyFormat } from "~/features/sales";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { RepAccount } from "../api/reps.queries";

// A list in a tab shows 10 rows, as the Orders and Reps pages.
const PAGE_SIZE = 10;

type RepAccountsTableProps = {
	/** Every account of the rep, the largest amount first. */
	accounts: RepAccount[];
	/** "Q4 2026". */
	quarterLabel: string;
};

/** The table card of the tab. */
export function RepAccountsTable({
	accounts,
	quarterLabel,
}: RepAccountsTableProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const columns: RecordColumn<RepAccount>[] = [
		{
			id: "name",
			header: t("orders.account"),
			sortValue: (account) => account.name,
			cell: (account) => <bdi className="font-medium">{account.name}</bdi>,
		},
		{
			id: "segment",
			header: t("orders.segment"),
			hideable: true,
			sortValue: (account) => t(`segments.${account.segment}`),
			cell: (account) => t(`segments.${account.segment}`),
		},
		{
			id: "orders",
			header: t("reps.orders"),
			align: "end",
			sortValue: (account) => account.orders,
			cell: (account) => number.format(account.orders),
		},
		{
			id: "amount",
			header: t("reps.booked"),
			align: "end",
			sortValue: (account) => account.amount,
			cell: (account) => money.format(account.amount),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reps.accountsTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("reps.accountsDescription"), {
						quarter: quarterLabel,
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="min-w-0">
				<RecordTable
					rows={accounts}
					columns={columns}
					searchText={(account) => account.name}
					searchPlaceholder={t("reps.filterAccounts")}
					pageSize={PAGE_SIZE}
					noResults={t("reps.noAccounts")}
				/>
			</CardContent>
		</Card>
	);
}
