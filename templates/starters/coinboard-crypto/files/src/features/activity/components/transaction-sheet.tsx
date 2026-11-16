// The side panel of one transaction: its status, its reference, its asset, and its amounts.
// ActivityPage opens it when the user clicks a row. A link in it opens the page of the asset.
import { Link } from "@tanstack/react-router";
import {
	AssetGlyph,
	fillMessage,
	formatPrice,
	formatQuantity,
	moneyFormat,
	TRANSACTION_STATUS_BADGE,
	TransactionTypeIcon,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { ArrowRightIcon } from "~/shared/ui/icons";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import type { Transaction } from "../api/transactions.queries";

type TransactionSheetProps = {
	/** The transaction to show. null keeps the panel closed. */
	transaction: Transaction | null;
	/** Runs when the user closes the panel. */
	onClose: () => void;
};

// The money that left or arrived: a buy and a withdrawal add the fee, a sell loses it.
function totalOf(transaction: Transaction): number {
	if (transaction.type === "sell") {
		return transaction.amount - transaction.fee;
	}
	return transaction.amount + transaction.fee;
}

/** A controlled panel on the end side. On a phone it takes the full width. */
export function TransactionSheet({
	transaction,
	onClose,
}: TransactionSheetProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "long",
		timeStyle: "short",
	});

	return (
		<Sheet
			open={transaction !== null}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{transaction ? (
					<>
						<SheetHeader className="gap-3 p-6">
							<div className="flex items-center gap-3 pe-8">
								<TransactionTypeIcon
									type={transaction.type}
									className="size-10"
								/>
								<div className="grid gap-0.5">
									<SheetTitle>
										{fillMessage(t(`ledger.typeLines.${transaction.type}`), {
											quantity: formatQuantity(transaction.quantity, locale),
											symbol: transaction.assetSymbol,
										})}
									</SheetTitle>
									<SheetDescription>
										{dateTime.format(new Date(transaction.occurredAt))}
									</SheetDescription>
								</div>
							</div>
						</SheetHeader>
						<div className="grid gap-6 px-6 pb-6">
							<div className="grid justify-items-start gap-2 rounded-surface border bg-muted/40 p-4">
								<Badge variant={TRANSACTION_STATUS_BADGE[transaction.status]}>
									{t(`ledger.statuses.${transaction.status}`)}
								</Badge>
								<p className="text-muted-foreground text-sm">
									{t(`activity.statusNotes.${transaction.status}`)}
								</p>
							</div>
							<dl className="grid gap-3 text-sm">
								<div className="flex items-center justify-between gap-3">
									<dt className="text-muted-foreground">
										{t("activity.asset")}
									</dt>
									<dd className="flex items-center gap-2 font-medium">
										<AssetGlyph
											symbol={transaction.assetSymbol}
											category={transaction.assetCategory}
										/>
										{transaction.assetName}
									</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3">
									<dt className="text-muted-foreground">
										{t("activity.account")}
									</dt>
									<dd>{t(`ledger.accounts.${transaction.account}`)}</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3">
									<dt className="text-muted-foreground">
										{t("activity.reference")}
									</dt>
									<dd className="tabular-nums">{transaction.reference}</dd>
								</div>
							</dl>
							<dl className="grid gap-3 border-t pt-6 text-sm">
								<div className="flex items-baseline justify-between gap-3">
									<dt className="text-muted-foreground">
										{t("activity.quantity")}
									</dt>
									<dd className="tabular-nums">
										{`${formatQuantity(transaction.quantity, locale)} ${transaction.assetSymbol}`}
									</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3">
									<dt className="text-muted-foreground">
										{t("activity.price")}
									</dt>
									<dd className="tabular-nums">
										{formatPrice(transaction.unitPrice, locale)}
									</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3">
									<dt className="text-muted-foreground">
										{t("activity.amount")}
									</dt>
									<dd className="tabular-nums">
										{money.format(transaction.amount)}
									</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3">
									<dt className="text-muted-foreground">{t("activity.fee")}</dt>
									<dd className="tabular-nums">
										{money.format(transaction.fee)}
									</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3 border-t pt-3">
									<dt className="font-medium">{t("activity.total")}</dt>
									<dd className="font-numeric font-semibold text-lg tabular-nums">
										{money.format(totalOf(transaction))}
									</dd>
								</div>
							</dl>
						</div>
						<SheetFooter className="p-6 pt-0">
							<Button asChild variant="outline">
								<Link
									to="/app/markets/$assetId"
									params={{ assetId: transaction.assetId }}
								>
									{fillMessage(t("activity.openAsset"), {
										name: transaction.assetName,
									})}
									<ArrowRightIcon className="rtl:rotate-180" />
								</Link>
							</Button>
						</SheetFooter>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
