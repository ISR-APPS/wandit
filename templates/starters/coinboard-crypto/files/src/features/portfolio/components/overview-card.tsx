// The overview card of the home: a tinted card with a background-color panel of the transaction count, the account count,
// the portfolio value, and the 24-hour change with a link to Holdings. PortfolioPage renders it first in band 1.
import { ArrowDownRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { moneyFormat, signedMoneyFormat } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import type { PortfolioSummary } from "../api/portfolio.queries";

type OverviewCardProps = {
	summary: PortfolioSummary;
};

/** The badge shows the 24-hour change as a percent. No earlier value gives no badge, never "0%". */
export function OverviewCard({ summary }: OverviewCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const ratio = summary.dayChangeRatio;
	const isUp = summary.dayChange >= 0;

	return (
		<Card className="h-full gap-1 overflow-hidden bg-linear-to-br from-chart-1/45 to-chart-2/55 py-0">
			<CardHeader className="pt-6">
				<CardTitle className="font-display text-2xl">
					{t("portfolio.overviewTitle")}
				</CardTitle>
			</CardHeader>
			<CardContent className="p-4">
				<div className="grid gap-6 rounded-lg bg-background p-4">
					<div className="flex justify-between gap-4">
						<div className="grid content-start gap-1">
							<p className="font-numeric font-semibold text-4xl tabular-nums">
								{number.format(summary.transactionCount)}
							</p>
							<p className="text-muted-foreground">
								{t("portfolio.transactions")}
							</p>
						</div>
						<div className="grid content-center justify-items-center rounded-lg bg-muted px-4 py-3">
							<p className="font-numeric font-semibold text-3xl tabular-nums">
								{number.format(summary.accountCount)}
							</p>
							<p className="text-muted-foreground">{t("portfolio.accounts")}</p>
						</div>
					</div>
					<div className="grid gap-1">
						<p className="font-numeric @4xl/main:text-4xl text-3xl tabular-nums">
							{moneyFormat(locale).format(summary.value)}
						</p>
						<p className="text-muted-foreground">
							{t("portfolio.currentValue")}
						</p>
					</div>
					<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
						<div className="flex items-center gap-1.5">
							<span className="font-numeric font-semibold text-lg tabular-nums">
								<bdi dir="ltr">
									{signedMoneyFormat(locale, 0).format(summary.dayChange)}
								</bdi>
							</span>
							<span className="text-muted-foreground">
								{t("portfolio.dayChangeShort")}
							</span>
							{ratio === null ? null : (
								<Badge
									variant={isUp ? "success" : "outline"}
									// The base has no soft red badge, so a fall takes the tint of a destructive text.
									className={
										isUp
											? undefined
											: "border-destructive/25 bg-destructive/12 text-destructive"
									}
								>
									{isUp ? <ArrowUpRightIcon /> : <ArrowDownRightIcon />}
									<bdi dir="ltr">{percent.format(ratio)}</bdi>
								</Badge>
							)}
						</div>
						<Button asChild>
							<Link to="/app/holdings">
								{t("holdings.title")}
								<CaretRightIcon className="rtl:rotate-180" />
							</Link>
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
