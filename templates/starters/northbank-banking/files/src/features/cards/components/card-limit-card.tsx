// The spend of this month of one card against its monthly limit, with the amount left,
// the count of payments this month, and the last payment day.
// CardDetailPage renders it beside the top merchants. The limit resets on the 1st of each month.
import {
	fillMessage,
	MoneyText,
	monthStartOf,
	relativeDayLabel,
	todayIsoDay,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { CardDetail } from "../lib/card-spend";

type DetailCardProps = {
	/** The card, its payments, and its top merchants, from cardDetailQueryOptions. */
	detail: CardDetail;
};

/** The spend of this month against the monthly limit of the card. Returned payments do not count. */
export function CardLimitCard({ detail }: DetailCardProps) {
	const { t, locale } = useT();
	const { card, monthSpendCents, lastUsedDay } = detail.summary;
	const today = todayIsoDay();
	const monthStart = monthStartOf(today);
	const monthPayments = detail.transactions.filter(
		(row) => row.day >= monthStart,
	).length;
	const left = Math.max(card.monthlyLimitCents - monthSpendCents, 0);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("cards.limitTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("cards.limitUsed"), {
						share: percent.format(monthSpendCents / card.monthlyLimitCents),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3">
				<div className="flex flex-wrap items-baseline gap-x-2">
					<MoneyText
						amountCents={monthSpendCents}
						withCents={false}
						className="font-semibold text-2xl"
					/>
					<span className="text-muted-foreground text-sm">
						{`${t("cards.of")} `}
						<MoneyText amountCents={card.monthlyLimitCents} withCents={false} />
					</span>
				</div>
				<Progress
					value={monthSpendCents}
					max={card.monthlyLimitCents}
					aria-label={t("cards.limitTitle")}
				/>
				<p className="text-muted-foreground text-sm">
					<MoneyText amountCents={left} withCents={false} />
					{` ${t("cards.left")}`}
				</p>
				<dl className="grid grid-cols-2 gap-4 border-t pt-4 text-sm">
					<div className="grid gap-1">
						<dt className="text-muted-foreground">
							{t("cards.paymentsThisMonth")}
						</dt>
						<dd className="tabular-nums">
							{new Intl.NumberFormat(locale).format(monthPayments)}
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("cards.lastPayment")}</dt>
						<dd>
							{lastUsedDay
								? relativeDayLabel(lastUsedDay, today, locale)
								: t("cards.neverUsed")}
						</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}
