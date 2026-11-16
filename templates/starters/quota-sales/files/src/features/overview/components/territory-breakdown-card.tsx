// The breakdown of the home: booked amount by territory in the last 30 closed days, as ranked bars.
// OverviewPage passes the slices of territoryBookingsQueryOptions. The title names the period.
import { Link } from "@tanstack/react-router";
import { type BreakdownSlice, moneyFormat, RankedBars } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type TerritoryBreakdownCardProps = {
	/** One slice per territory, largest first. The labels are territory names. */
	slices: BreakdownSlice[];
};

/** The ranked bars, then the team total at the foot. Zero bookings shows one sentence and a link to the targets. */
export function TerritoryBreakdownCard({
	slices,
}: TerritoryBreakdownCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const isEmpty = slices.every((slice) => slice.value === 0);
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.territoryTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				{isEmpty ? (
					<div className="grid justify-items-center gap-2 py-10 text-center">
						<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
						<Link to="/app/targets" className="font-medium text-sm underline">
							{t("chart.breakdownEmptyAction")}
						</Link>
					</div>
				) : (
					<>
						{/* The card matches the height of the trend, so the rows spread over it. */}
						<RankedBars slices={slices} className="flex-1 content-around" />
						<div className="mt-auto flex items-baseline justify-between gap-3 border-t pt-4 text-sm">
							<span className="text-muted-foreground">
								{t("overview.teamTotal")}
							</span>
							<span className="font-numeric font-semibold text-lg tabular-nums">
								{money.format(total)}
							</span>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
