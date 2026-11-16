// The payments to one payee: the 90-day total with its average, then one bar per month for 6 months.
// PayeeDetailPage renders it beside the bank details. The bars are plain elements, not a chart.
import { countLabel, dayToDate, MoneyText, monthFormat } from "~/features/bank";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { PayeeDetail } from "../lib/payee-summary";

type PayeeMonthsCardProps = {
	/** The payee figures and its 6 monthly totals, from payeeDetailQueryOptions. */
	detail: PayeeDetail;
};

/** A month with no payment keeps its row with an empty track, so the months stay in order. */
export function PayeeMonthsCard({ detail }: PayeeMonthsCardProps) {
	const { t, locale } = useT();
	const { paidCents, paymentCount } = detail.summary;
	const largest = Math.max(
		...detail.months.map((month) => month.totalCents),
		0,
	);
	const monthName = new Intl.DateTimeFormat(locale, {
		month: "short",
		timeZone: "UTC",
	});
	const fullMonth = monthFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("payees.paidTitle")}</CardTitle>
				<CardDescription>
					{countLabel(
						paymentCount,
						t("payees.paymentOne"),
						t("payees.paymentOther"),
						locale,
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				<div className="grid gap-1">
					<MoneyText
						amountCents={paidCents}
						withCents={false}
						className="font-semibold text-3xl"
					/>
					{paymentCount > 0 ? (
						<span className="text-muted-foreground text-sm">
							{`${t("payees.average")} `}
							<MoneyText
								amountCents={Math.round(paidCents / paymentCount)}
								withCents={false}
							/>
						</span>
					) : null}
				</div>
				<div className="grid gap-3 border-t pt-5">
					<span className="label-text text-muted-foreground text-xs">
						{t("payees.byMonth")}
					</span>
					<ul className="grid gap-2.5 text-sm">
						{detail.months.map((month) => (
							<li
								key={month.month}
								className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3"
							>
								<span
									className="text-muted-foreground"
									title={fullMonth.format(dayToDate(month.month))}
								>
									{monthName.format(dayToDate(month.month))}
								</span>
								<span aria-hidden="true" className="h-2 rounded-sm bg-muted">
									<span
										className="block h-full rounded-sm bg-chart-1"
										style={{
											width: `${largest > 0 ? (month.totalCents / largest) * 100 : 0}%`,
										}}
									/>
								</span>
								<MoneyText amountCents={month.totalCents} withCents={false} />
							</li>
						))}
					</ul>
				</div>
			</CardContent>
		</Card>
	);
}
