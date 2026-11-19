// The card limits card of the home: the card spend of this month, a stacked bar of the spend per card,
// one row per active card with its share of its own limit, and a muted note at the foot.
// OverviewPage renders it in the middle grid with the card summaries of ~/features/cards.
import { ArrowUpRightIcon, InfoIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	addMonths,
	centsToUnits,
	countLabel,
	dayFormat,
	dayToDate,
	fillMessage,
	moneyFormat,
	NEAR_LIMIT_SHARE,
	todayIsoDay,
} from "~/features/bank";
import type { CardSummary } from "~/features/cards";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";

type CardLimitsCardProps = {
	/** Every card with its spend this month, from cardsQueryOptions. Only active cards show. */
	summaries: CardSummary[];
};

/** Each card keeps one chart color in the bar and in its row, and the row names it, so color is never the only mark. */
export function CardLimitsCard({ summaries }: CardLimitsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale, 0);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	// LIMIT: five chart colors, so at most five active cards get a bar part. Upgrade: fold the rest into "Other".
	const active = summaries
		.filter((summary) => summary.status === "active")
		.slice(0, 5);
	const spentCents = active.reduce(
		(sum, item) => sum + item.monthSpendCents,
		0,
	);
	const limitCents = active.reduce(
		(sum, item) => sum + item.card.monthlyLimitCents,
		0,
	);
	const nearLimit = active.filter(
		(item) =>
			item.monthSpendCents >= item.card.monthlyLimitCents * NEAR_LIMIT_SHARE,
	).length;
	const resetDay = dayFormat(locale, "long").format(
		dayToDate(addMonths(todayIsoDay(), 1)),
	);

	return (
		<Card className="overflow-hidden pb-0">
			<CardHeader>
				<CardTitle>{t("overview.limits.title")}</CardTitle>
				<CardAction>
					<Button variant="ghost" size="icon" className="size-8" asChild>
						<Link to="/app/cards" aria-label={t("overview.limits.open")}>
							<ArrowUpRightIcon className="rtl:-scale-x-100" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid flex-1 content-start gap-6">
				<div className="grid gap-1">
					<p className="text-muted-foreground text-sm">
						{t("overview.limits.spent")}
					</p>
					<p className="font-numeric font-semibold text-3xl tabular-nums">
						{money.format(centsToUnits(spentCents))}
					</p>
					<p className="text-muted-foreground text-sm">
						{fillMessage(t("overview.limits.ofLimits"), {
							share:
								limitCents === 0
									? "–"
									: percent.format(spentCents / limitCents),
							limit: money.format(centsToUnits(limitCents)),
						})}
					</p>
				</div>
				{spentCents > 0 ? (
					<div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
						{active.map((item, index) => (
							<Tooltip key={item.card.id}>
								<TooltipTrigger asChild>
									<span
										className="h-full"
										style={{
											width: `${(item.monthSpendCents / spentCents) * 100}%`,
											backgroundColor: `var(--chart-${index + 1})`,
										}}
									/>
								</TooltipTrigger>
								<TooltipContent>
									{`${item.card.holderName} ••${item.card.numberEnding}: ${money.format(centsToUnits(item.monthSpendCents))}`}
								</TooltipContent>
							</Tooltip>
						))}
					</div>
				) : null}
				<ul className="grid gap-4">
					{active.map((item, index) => {
						const share =
							item.card.monthlyLimitCents === 0
								? 0
								: item.monthSpendCents / item.card.monthlyLimitCents;
						return (
							<li
								key={item.card.id}
								className="flex items-center gap-3 text-sm"
							>
								<span
									aria-hidden="true"
									className="size-3 shrink-0 rounded-full"
									style={{ backgroundColor: `var(--chart-${index + 1})` }}
								/>
								<Link
									to="/app/cards/$cardId"
									params={{ cardId: item.card.id }}
									className="min-w-0 flex-1 truncate text-muted-foreground hover:text-foreground hover:underline"
								>
									{`${item.card.holderName} ••${item.card.numberEnding}`}
								</Link>
								<span className="font-medium tabular-nums">
									{money.format(centsToUnits(item.monthSpendCents))}
								</span>
								<Progress
									value={share * 100}
									aria-label={`${item.card.holderName}: ${percent.format(share)}`}
									// A phone-width card has no room for the bar; the percent stays.
									className="@md/main:block hidden h-1.5 w-12 shrink-0"
								/>
								<span className="w-9 shrink-0 text-end text-muted-foreground text-xs tabular-nums">
									{percent.format(share)}
								</span>
							</li>
						);
					})}
				</ul>
			</CardContent>
			<p className="flex items-start gap-3 border-t bg-muted px-6 py-4 text-muted-foreground text-sm">
				<InfoIcon className="mt-0.5 size-4 shrink-0" />
				{nearLimit > 0
					? fillMessage(
							countLabel(
								nearLimit,
								t("overview.limits.nearOne"),
								t("overview.limits.nearOther"),
								locale,
							),
							{ day: resetDay },
						)
					: fillMessage(t("overview.limits.okNote"), { day: resetDay })}
			</p>
		</Card>
	);
}
