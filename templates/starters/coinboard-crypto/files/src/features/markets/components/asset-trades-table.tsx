// The Transactions tab of the asset page: every transaction of the asset in a RecordTable with sort, pages,
// a status filter, and a row menu (open in Activity, copy the reference). AssetDetailPage renders it in a Card.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Transaction } from "~/features/activity";
import {
	copyToClipboard,
	fillMessage,
	formatPrice,
	formatQuantity,
	moneyFormat,
	TRANSACTION_STATUS_BADGE,
	TRANSACTION_STATUSES,
	TRANSACTION_TYPE_BADGE,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";

// A list in a tab shows 20 rows per page, like a list page.
const PAGE_SIZE = 20;

type AssetTradesTableProps = {
	/** The transactions of the asset, newest first, from assetTransactionsQueryOptions(). */
	transactions: Transaction[];
};

/** The date column sorts by the ISO time, so the order is the time order. */
export function AssetTradesTable({ transactions }: AssetTradesTableProps) {
	const { t, locale } = useT();
	const [status, setStatus] = useState<string | null>(null);
	const money = moneyFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const rows =
		status === null
			? transactions
			: transactions.filter((row) => row.status === status);

	const columns: RecordColumn<Transaction>[] = [
		{
			id: "date",
			header: t("activity.date"),
			sortValue: (row) => row.occurredAt,
			cell: (row) => (
				<span className="tabular-nums">
					{dateTime.format(new Date(row.occurredAt))}
				</span>
			),
		},
		{
			id: "type",
			header: t("activity.type"),
			sortValue: (row) => t(`ledger.types.${row.type}`),
			cell: (row) => (
				<Badge variant={TRANSACTION_TYPE_BADGE[row.type]}>
					{t(`ledger.types.${row.type}`)}
				</Badge>
			),
		},
		{
			id: "quantity",
			header: t("activity.quantity"),
			align: "end",
			sortValue: (row) => row.quantity,
			cell: (row) =>
				`${formatQuantity(row.quantity, locale)} ${row.assetSymbol}`,
		},
		{
			id: "price",
			header: t("activity.price"),
			align: "end",
			hideable: true,
			sortValue: (row) => row.unitPrice,
			cell: (row) => formatPrice(row.unitPrice, locale),
		},
		{
			id: "amount",
			header: t("activity.amount"),
			align: "end",
			hideable: true,
			sortValue: (row) => row.amount,
			cell: (row) => money.format(row.amount),
		},
		{
			id: "status",
			header: t("activity.status"),
			cell: (row) => (
				<Badge variant={TRANSACTION_STATUS_BADGE[row.status]}>
					{t(`ledger.statuses.${row.status}`)}
				</Badge>
			),
		},
	];

	return (
		<RecordTable
			rows={rows}
			columns={columns}
			searchText={(row) => row.reference}
			searchPlaceholder={t("activity.searchReference")}
			toolbar={
				<RecordFilter
					label={t("activity.status")}
					options={TRANSACTION_STATUSES.map((value) => ({
						value,
						label: t(`ledger.statuses.${value}`),
					}))}
					value={status}
					onValueChange={setStatus}
				/>
			}
			rowMenu={(row) => (
				<>
					<DropdownMenuItem asChild>
						<Link to="/app/activity" search={{ tx: row.id }}>
							{fillMessage(t("activity.open"), { reference: row.reference })}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							copyToClipboard(row.reference, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						{t("activity.copyReference")}
					</DropdownMenuItem>
				</>
			)}
			pageSize={PAGE_SIZE}
			noResults={t("activity.noResults")}
		/>
	);
}
