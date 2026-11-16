// The 5 largest accounts of one rep in the current quarter: name, segment, order count, and amount.
// RepDetailPage renders it in the rail.
import { fillMessage, moneyFormat, pluralOf } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { RepAccount } from "../api/reps.queries";

type RepAccountsCardProps = {
	/** Largest amount first. */
	accounts: RepAccount[];
};

/** A short list. No account yet shows one sentence. */
export function RepAccountsCard({ accounts }: RepAccountsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reps.accountsTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				{accounts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("reps.accountsEmpty")}
					</p>
				) : (
					<ul className="grid divide-y divide-border">
						{accounts.map((account) => (
							<li
								key={account.id}
								className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
							>
								<div className="grid min-w-0 justify-items-start">
									<bdi className="truncate font-medium text-sm">
										{account.name}
									</bdi>
									<span className="text-muted-foreground text-xs">
										{`${t(`segments.${account.segment}`)} · ${fillMessage(
											t(
												`reps.accountOrders.${pluralOf(locale, account.orders)}`,
											),
											{ count: number.format(account.orders) },
										)}`}
									</span>
								</div>
								<span className="font-medium text-sm tabular-nums">
									{money.format(account.amount)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
