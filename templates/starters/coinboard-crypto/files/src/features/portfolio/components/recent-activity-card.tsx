// The recent activity card of the home: the 6 newest transactions with the asset, a type badge, the time,
// a status badge when the row is not confirmed, the units, and the amount, then a "View all" link to Activity. PortfolioPage renders it first in band 2.
import { Link } from "@tanstack/react-router";
import type { Transaction } from "~/features/activity";
import {
	AssetGlyph,
	formatQuantity,
	moneyFormat,
	TRANSACTION_STATUS_BADGE,
	TRANSACTION_TYPE_BADGE,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

// 6 rows give the card the height of the balance chart beside it.
const SHOWN_ROWS = 6;

type RecentActivityCardProps = {
	/** Every transaction, the newest first, as transactionsQueryOptions returns them. */
	transactions: Transaction[];
};

/** No transaction shows one muted sentence instead of the list. */
export function RecentActivityCard({ transactions }: RecentActivityCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("portfolio.activityTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-6">
				{transactions.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("portfolio.activityEmpty")}
					</p>
				) : (
					<ul className="grid gap-6">
						{transactions.slice(0, SHOWN_ROWS).map((transaction) => (
							<li key={transaction.id} className="flex items-center gap-4">
								<AssetGlyph
									symbol={transaction.assetSymbol}
									category={transaction.assetCategory}
									size="lg"
								/>
								<div className="grid min-w-0 gap-1">
									{/* A narrow card puts the type badge under the name, so it never covers the amount. */}
									<p className="flex flex-wrap items-center gap-2 font-medium text-sm leading-none">
										<span className="min-w-0 truncate">
											{transaction.assetName}
										</span>
										<Badge variant={TRANSACTION_TYPE_BADGE[transaction.type]}>
											{t(`ledger.types.${transaction.type}`)}
										</Badge>
										{/* A pending or failed row must not look complete, so it shows its status too. */}
										{transaction.status === "confirmed" ? null : (
											<Badge
												variant={TRANSACTION_STATUS_BADGE[transaction.status]}
											>
												{t(`ledger.statuses.${transaction.status}`)}
											</Badge>
										)}
									</p>
									<p className="text-muted-foreground text-sm">
										{dateTime.format(new Date(transaction.occurredAt))}
									</p>
								</div>
								<div className="ms-auto flex shrink-0 flex-col text-end tabular-nums">
									<span>{`${formatQuantity(transaction.quantity, locale)} ${transaction.assetSymbol}`}</span>
									<span className="text-muted-foreground text-sm">
										{money.format(transaction.amount)}
									</span>
								</div>
							</li>
						))}
					</ul>
				)}
				<Button variant="outline" className="w-full" asChild>
					<Link to="/app/activity">{t("common.viewAll")}</Link>
				</Button>
			</CardContent>
		</Card>
	);
}
