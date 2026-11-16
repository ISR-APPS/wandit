// The route card of a transfer on the transaction detail page: the account that the money left
// and the account that it reached. TransactionDetailPage renders it under the slip of a transfer.
// The tile of the other half opens that entry.
import { Link } from "@tanstack/react-router";
import { MoneyText } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { ArrowRightIcon } from "~/shared/ui/icons";
import type { TransactionRow } from "../api/transactions.queries";

type TransferRouteCardProps = {
	/** The entry of the page: one half of the transfer. */
	transaction: TransactionRow;
	/** The other half: the same amount with the opposite sign, on the other account. */
	linked: TransactionRow;
};

/** The half with the negative amount is the start of the route. */
export function TransferRouteCard({
	transaction,
	linked,
}: TransferRouteCardProps) {
	const { t } = useT();
	const halves =
		transaction.amountCents < 0 ? [transaction, linked] : [linked, transaction];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("transactions.routeTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid @2xl/main:grid-cols-[1fr_auto_1fr] items-center gap-3">
				{halves.map((half, index) => {
					const isThisEntry = half.id === transaction.id;
					const tile = (
						<>
							<span className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
								{t(
									index === 0
										? "transactions.routeFrom"
										: "transactions.routeTo",
								)}
								<span>
									{isThisEntry
										? t("transactions.routeThisEntry")
										: t("transactions.openLinked")}
								</span>
							</span>
							<bdi className="font-medium">{half.accountName}</bdi>
							<MoneyText
								amountCents={half.amountCents}
								sign="always"
								className="justify-self-start text-lg"
							/>
						</>
					);
					return (
						// The arrow sits between the two tiles. On a phone it points down.
						<div key={half.id} className="contents">
							{index === 1 ? (
								<ArrowRightIcon className="size-5 @2xl/main:rotate-0 rotate-90 justify-self-center text-muted-foreground @2xl/main:rtl:rotate-180" />
							) : null}
							{isThisEntry ? (
								<div className="grid gap-1 rounded-surface border bg-muted/40 p-4">
									{tile}
								</div>
							) : (
								<Link
									to="/app/transactions/$transactionId"
									params={{ transactionId: half.id }}
									className={cn(
										"grid gap-1 rounded-surface border p-4 outline-none",
										"hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
									)}
								>
									{tile}
								</Link>
							)}
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
