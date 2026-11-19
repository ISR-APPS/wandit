// The "Sales by region" card of the home: the 6 sales areas with the most revenue, each with its change and a bar.
// OverviewPage renders it at the start of the third band. Export downloads the rows as CSV.
// The bar of each area is its revenue against the best area, so the best area fills its bar.
import { ExportIcon } from "@phosphor-icons/react";
import {
	ChangeBadge,
	downloadCsv,
	fillMessage,
	moneyFormat,
	toCsv,
} from "~/features/shop";
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
import { Progress } from "~/shared/ui/progress";
import type { AreaRevenue } from "../lib/summary";

type RegionSalesCardProps = {
	/** The best areas of the period, the best first. */
	areas: AreaRevenue[];
	/** The length of the period, already written, for example "30 days". */
	periodText: string;
	className?: string;
};

/** No revenue in the period: one sentence in place of the rows. */
export function RegionSalesCard({
	areas,
	periodText,
	className,
}: RegionSalesCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale, "whole");
	const best = areas[0]?.revenue ?? 0;

	function exportAreas() {
		downloadCsv(
			"sales-by-region.csv",
			toCsv(
				areas.map((area) => ({ ...area, id: area.area })),
				[
					{
						header: t("overview.regions.region"),
						value: (row) => t(`areas.${row.area}`),
					},
					{
						header: t("overview.regions.revenue"),
						value: (row) => String(row.revenue),
					},
				],
			),
		);
	}

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("overview.regions.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.regions.description"), {
						period: periodText,
					})}
				</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						disabled={areas.length === 0}
						onClick={exportAreas}
					>
						<ExportIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{areas.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.regions.empty")}
					</p>
				) : (
					<ul className="grid gap-5">
						{areas.map((area) => (
							<li key={area.area} className="grid gap-2">
								<div className="flex items-center justify-between gap-2">
									<div className="flex min-w-0 items-center gap-2">
										<span className="truncate text-sm">
											{t(`areas.${area.area}`)}
										</span>
										<ChangeBadge
											change={area.change}
											goodWhen="up"
											look="badge"
										/>
									</div>
									<span className="text-sm tabular-nums">
										{money.format(area.revenue)}
									</span>
								</div>
								<Progress
									value={area.revenue}
									max={best}
									aria-label={t(`areas.${area.area}`)}
								/>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
