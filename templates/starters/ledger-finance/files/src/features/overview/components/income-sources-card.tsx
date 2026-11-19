// The income sources card of the home: the income of the period, one stacked bar, and one row per category.
// OverviewPage renders it first in the middle band. The footer states the largest source and the count of payments.
// The arrow button opens the transactions page on the income entries.
import { ArrowUpRightIcon, LightbulbIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { ChangeLine, fillMessage, MoneyText } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { CategoryAmount, Figure } from "../lib/overview-summary";

type IncomeSourcesCardProps = {
	/** The income of the period and its change against the period before. */
	income: Figure;
	/** Income by category, the largest first. */
	sources: CategoryAmount[];
	/** Count of the income entries of the period. */
	paymentCount: number;
	/** The muted context after the delta, for example "vs the 30 days before". */
	deltaContext: string;
};

/** Each segment of the bar has its name and amount in the list under it, so the color is never the only mark. */
export function IncomeSourcesCard({
	income,
	sources,
	paymentCount,
	deltaContext,
}: IncomeSourcesCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const number = new Intl.NumberFormat(locale);
	const total = income.valueCents;
	const largest = sources[0];

	return (
		<Card className="overflow-hidden pb-0">
			<CardHeader>
				<CardTitle>{t("overview.incomeTitle")}</CardTitle>
				<CardAction>
					<Button
						asChild
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t("overview.openIncome")}
					>
						<Link to="/app/transactions" search={{ type: "income" }}>
							<ArrowUpRightIcon className="rtl:-scale-x-100" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid flex-1 content-start gap-6">
				<div className="grid gap-2">
					<p className="text-muted-foreground text-sm">
						{t("overview.totalIncome")}
					</p>
					<MoneyText
						amountCents={total}
						withCents={false}
						className="text-3xl"
					/>
					<p className="flex flex-wrap items-center gap-x-1 text-sm">
						<ChangeLine
							change={income.change}
							goodWhen="up"
							className="text-sm"
						/>
						<span className="text-muted-foreground">{deltaContext}</span>
					</p>
				</div>
				{total > 0 ? (
					<div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
						{sources.map((source, index) => (
							<div
								key={source.categoryId}
								className="h-full"
								style={{
									width: `${(source.amountCents / total) * 100}%`,
									// The chart series 1 to 5 color the sources in the order of the list.
									backgroundColor: `var(--chart-${(index % 5) + 1})`,
								}}
							/>
						))}
					</div>
				) : null}
				{sources.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.noIncome")}
					</p>
				) : (
					<ul className="grid gap-4">
						{sources.map((source, index) => (
							<li
								key={source.categoryId}
								className="flex items-center justify-between gap-3 text-sm"
							>
								<span className="flex min-w-0 items-center gap-3">
									<span
										aria-hidden="true"
										className="size-3 shrink-0 rounded-full"
										style={{
											backgroundColor: `var(--chart-${(index % 5) + 1})`,
										}}
									/>
									<span className="truncate text-muted-foreground">
										{t(`categories.${source.categoryId}`)}
									</span>
								</span>
								<MoneyText
									amountCents={source.amountCents}
									withCents={false}
									className="font-medium"
								/>
							</li>
						))}
					</ul>
				)}
			</CardContent>
			<CardFooter className="items-start gap-3 bg-muted py-4">
				<LightbulbIcon
					aria-hidden="true"
					className="mt-0.5 size-5 shrink-0 text-muted-foreground"
				/>
				<div className="grid gap-1 text-muted-foreground text-sm">
					{largest && total > 0 ? (
						<p className="font-medium">
							{fillMessage(t("overview.largestSource"), {
								source: t(`categories.${largest.categoryId}`),
								share: percent.format(largest.amountCents / total),
							})}
						</p>
					) : null}
					<p>
						{fillMessage(t("overview.paymentCount"), {
							count: number.format(paymentCount),
						})}
					</p>
				</div>
			</CardFooter>
		</Card>
	);
}
