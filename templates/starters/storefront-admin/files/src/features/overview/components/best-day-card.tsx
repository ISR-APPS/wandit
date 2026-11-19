// The lead card of the home: the best day of the period, its revenue, how far it is above the daily average,
// and a link to the orders. OverviewPage renders it at the start of the first band, beside the stat cards.
// A muted fill sets it apart from the white stat cards, as the kit welcome card does.
import { Link } from "@tanstack/react-router";
import { dayToDate, fillMessage, moneyFormat } from "~/features/shop";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { BestDay } from "../lib/summary";

type BestDayCardProps = {
	/** The best day of the period. null when the period has no revenue. */
	bestDay: BestDay | null;
	/** The length of the period, already written, for example "30 days". */
	periodText: string;
	className?: string;
};

/** No revenue in the period: the card says so and keeps the link. */
export function BestDayCard({
	bestDay,
	periodText,
	className,
}: BestDayCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	// The best day is at or above the average, so the sign is always "+".
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "always",
		maximumFractionDigits: 0,
	});
	const dayTitle = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	});

	return (
		<Card className={cn("bg-muted", className)}>
			<CardHeader>
				<CardTitle className="font-display text-2xl">
					{bestDay
						? dayTitle.format(dayToDate(bestDay.day))
						: t("overview.bestDay.none")}
				</CardTitle>
				<CardDescription>
					{bestDay
						? fillMessage(t("overview.bestDay.description"), {
								period: periodText,
								count: number.format(bestDay.orderCount),
							})
						: fillMessage(t("overview.bestDay.noneDescription"), {
								period: periodText,
							})}
				</CardDescription>
			</CardHeader>
			<CardContent className="mt-auto">
				<div className="flex flex-wrap items-center justify-between gap-4">
					{bestDay ? (
						<div className="grid gap-1">
							<p className="font-numeric text-3xl tabular-nums">
								{money.format(bestDay.revenue)}
							</p>
							<p className="text-muted-foreground text-xs">
								<bdi
									dir="ltr"
									className="font-medium text-success tabular-nums"
								>
									{percent.format(bestDay.aboveAverage)}
								</bdi>{" "}
								{t("overview.bestDay.aboveAverage")}
							</p>
						</div>
					) : null}
					<Button variant="outline" asChild>
						<Link to="/app/orders">{t("overview.bestDay.viewOrders")}</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
