// The transactions card of the asset page: every transaction of the user for this asset, newest first.
// AssetDetailPage renders it under the price card. An asset with no transaction shows one sentence.
// It shows the 8 newest rows first. A button opens the full list. A type cell opens the side panel of Activity.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Transaction } from "~/features/activity";
import {
	fillMessage,
	formatPrice,
	moneyFormat,
	TRANSACTION_STATUS_BADGE,
	TransactionTypeIcon,
	UNIT_DIRECTION,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
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

// The card first shows this many rows, so a staked asset with many rewards does not stretch the page.
const COLLAPSED_COUNT = 8;

type AssetTransactionsCardProps = {
	/** The ticker of the asset, for the empty sentence. */
	symbol: string;
	/** The transactions of the asset, newest first, from assetTransactionsQueryOptions(). */
	transactions: Transaction[];
};

/** The quantity has a sign: plus for units in, minus for units out. A button under the table shows the older rows. */
export function AssetTransactionsCard({
	symbol,
	transactions,
}: AssetTransactionsCardProps) {
	const { t, locale } = useT();
	const [isExpanded, setIsExpanded] = useState(false);
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const shown = isExpanded
		? transactions
		: transactions.slice(0, COLLAPSED_COUNT);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const signedQuantity = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 4,
		signDisplay: "exceptZero",
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("asset.transactionsTitle")}</CardTitle>
				{transactions.length === 0 ? null : (
					<CardDescription>
						{fillMessage(t("asset.transactionsCount"), {
							count: number.format(transactions.length),
						})}
					</CardDescription>
				)}
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
								{/* A phone keeps the type and the amount. The date and the status move under them. */}
								<TableHead className="max-sm:hidden">
									{t("activity.date")}
								</TableHead>
								<TableHead className="text-end max-sm:hidden">
									{t("activity.quantity")}
								</TableHead>
								<TableHead className="text-end">
									{t("activity.amount")}
								</TableHead>
								<TableHead className="max-sm:hidden">
									{t("activity.status")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{shown.map((row) => (
								<TableRow key={row.id}>
									<TableCell>
										<Link
											to="/app/activity"
											search={{ tx: row.id }}
											aria-label={fillMessage(t("activity.open"), {
												reference: row.reference,
											})}
											className="group flex items-center gap-2 font-medium"
										>
											<TransactionTypeIcon type={row.type} className="size-7" />
											<span className="grid">
												<span className="group-hover:underline">
													{t(`ledger.types.${row.type}`)}
												</span>
												<span className="font-normal text-muted-foreground text-xs sm:hidden">
													{date.format(new Date(row.occurredAt))}
												</span>
											</span>
										</Link>
									</TableCell>
									<TableCell className="text-muted-foreground max-sm:hidden">
										{date.format(new Date(row.occurredAt))}
									</TableCell>
									<TableCell className="text-end tabular-nums max-sm:hidden">
										<span className="grid justify-items-end">
											{/* dir="ltr" keeps the sign in front of the quantity in an Arabic page. */}
											<bdi dir="ltr">
												{signedQuantity.format(
													UNIT_DIRECTION[row.type] * row.quantity,
												)}
											</bdi>
											<span className="text-muted-foreground text-xs">
												{`@ ${formatPrice(row.unitPrice, locale)}`}
											</span>
										</span>
									</TableCell>
									<TableCell className="text-end tabular-nums">
										<span className="grid justify-items-end gap-1">
											{money.format(row.amount)}
											<Badge
												variant={TRANSACTION_STATUS_BADGE[row.status]}
												className="sm:hidden"
											>
												{t(`ledger.statuses.${row.status}`)}
											</Badge>
										</span>
									</TableCell>
									<TableCell className="max-sm:hidden">
										<Badge variant={TRANSACTION_STATUS_BADGE[row.status]}>
											{t(`ledger.statuses.${row.status}`)}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
				{transactions.length > COLLAPSED_COUNT ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-4 max-sm:h-11"
						aria-expanded={isExpanded}
						onClick={() => setIsExpanded(!isExpanded)}
					>
						{isExpanded
							? t("asset.showNewest")
							: fillMessage(t("asset.showAll"), {
									count: number.format(transactions.length),
								})}
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}
