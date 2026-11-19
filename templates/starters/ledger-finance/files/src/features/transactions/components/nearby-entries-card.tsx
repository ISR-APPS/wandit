// The nearby card of the transaction page, in the kit connections list form: the other entries of the same day
// first, then of the nearest days. Each row has its payee mark, its payee, its day, account and amount, and an open button.
// TransactionDetailPage renders it beside the payee card. The arrow opens the transaction list.
import { Link } from "@tanstack/react-router";
import {
	centsToUnits,
	dayFormat,
	dayToDate,
	fillMessage,
	moneyFormat,
	PayeeAvatar,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import type { TransactionRow } from "../api/transactions.queries";

type NearbyEntriesCardProps = {
	/** The day of the open entry, as `YYYY-MM-DD`. */
	day: string;
	/** The other entries closest to that day, at most 5. From `TransactionDetail.nearby`. */
	rows: TransactionRow[];
};

/** Only a ledger with one entry shows the empty sentence. Each row shows its day, so a row of another day is clear. */
export function NearbyEntriesCard({ day, rows }: NearbyEntriesCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const shortDay = dayFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("transactions.nearbyTitle")}</CardTitle>
				<CardDescription>
					{dayFormat(locale, "long").format(dayToDate(day))}
				</CardDescription>
				<CardAction>
					<Button
						asChild
						variant="outline"
						size="icon"
						aria-label={t("transactions.openList")}
					>
						<Link to="/app/transactions">
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("transactions.nearbyEmpty")}
					</p>
				) : (
					<ul className="grid gap-4">
						{rows.map((row) => (
							<li key={row.id} className="flex items-center gap-3">
								<PayeeAvatar
									payee={row.payee}
									type={row.type}
									categoryId={row.categoryId}
								/>
								<div className="grid min-w-0 flex-1 gap-0.5">
									<span className="truncate font-medium text-sm" dir="auto">
										{row.payee}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{`${shortDay.format(dayToDate(row.day))} · ${row.accountName} · ${money.format(centsToUnits(row.amountCents))}`}
									</span>
								</div>
								<Button asChild variant="outline" size="sm">
									<Link
										to="/app/transactions/$transactionId"
										params={{ transactionId: row.id }}
										aria-label={fillMessage(t("transactions.openEntry"), {
											payee: row.payee,
										})}
									>
										{t("transactions.open")}
									</Link>
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
