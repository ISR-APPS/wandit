// The activity tile of the home: the 5 newest transactions with their type, account, time, amount, and status.
// PortfolioPage renders it with the transaction list. A row opens the Activity page with the panel of that transaction.
import { Link } from "@tanstack/react-router";
import type { Transaction } from "~/features/activity";
import {
	AssetGlyph,
	fillMessage,
	formatPrice,
	formatQuantity,
	formatRelativeTime,
	moneyFormat,
	TRANSACTION_STATUS_BADGE,
	TransactionTypeIcon,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// The tile shows this many rows. The Activity page lists all of them.
const LATEST_COUNT = 5;

type LatestActivityTileProps = {
	/** Every transaction, newest first, from transactionsQueryOptions(). */
	transactions: Transaction[];
	/** The grid span of the tile in the mosaic. */
	className?: string;
};

/** With no transaction, the tile shows one sentence. */
export function LatestActivityTile({
	transactions,
	className,
}: LatestActivityTileProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const now = Date.now();
	const latest = transactions.slice(0, LATEST_COUNT);

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("portfolio.activityTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("portfolio.activityDescription"), {
						count: new Intl.NumberFormat(locale).format(latest.length),
					})}
				</CardDescription>
				<CardAction>
					<Button
						asChild
						variant="ghost"
						size="sm"
						// A touch target of 44 px on a phone.
						className="-me-2 max-sm:h-11"
					>
						<Link to="/app/activity">{t("common.viewAll")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{latest.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("portfolio.activityEmpty")}
					</p>
				) : (
					<ul className="-mx-2 divide-y">
						{latest.map((row) => (
							<li key={row.id}>
								<Link
									to="/app/activity"
									search={{ tx: row.id }}
									className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/60"
								>
									<TransactionTypeIcon type={row.type} />
									<span className="grid min-w-0 flex-1 gap-0.5">
										<span className="truncate font-medium text-sm">
											{fillMessage(t(`ledger.typeLines.${row.type}`), {
												quantity: formatQuantity(row.quantity, locale),
												symbol: row.assetSymbol,
											})}
										</span>
										<span className="truncate text-muted-foreground text-xs">
											{`${t(`ledger.accounts.${row.account}`)} · ${formatRelativeTime(row.occurredAt, now, locale)}`}
										</span>
									</span>
									{/* From 48rem the row has room for the asset in its own column. A fixed width keeps the free space after the description. */}
									<span className="@3xl/main:flex hidden w-56 min-w-0 shrink-0 items-center gap-2">
										<AssetGlyph
											symbol={row.assetSymbol}
											category={row.assetCategory}
										/>
										<span className="grid min-w-0">
											<span className="truncate text-sm">{row.assetName}</span>
											<span className="truncate text-muted-foreground text-xs tabular-nums">
												{`@ ${formatPrice(row.unitPrice, locale)}`}
											</span>
										</span>
									</span>
									<span className="@xl/main:block hidden w-24">
										<Badge variant={TRANSACTION_STATUS_BADGE[row.status]}>
											{t(`ledger.statuses.${row.status}`)}
										</Badge>
									</span>
									<span className="grid @xl/main:w-28 w-24 justify-items-end gap-0.5">
										<span className="font-medium text-sm tabular-nums">
											{money.format(row.amount)}
										</span>
										{/* Under 36rem the status has no column of its own, so it sits under the amount. */}
										<span className="@xl/main:hidden text-muted-foreground text-xs">
											{t(`ledger.statuses.${row.status}`)}
										</span>
										<span className="@xl/main:inline hidden text-muted-foreground text-xs">
											{row.reference}
										</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
