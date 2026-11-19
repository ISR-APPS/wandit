// One KPI card of the home row: the label and the delta pill on one line, the value under them.
// OverviewPage renders four of them. The delta pill is ChangePill of the tracking feature.
import { ChangePill } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";

type StatCardProps = {
	/** The translated label, for example "Active accounts". */
	label: string;
	/** The formatted value, for example "1,284" or "41.8%". */
	value: string;
	/** Ratio against the period before: 0.12 is +12 %. null shows "No earlier data" in place of the pill. */
	change: number | null;
};

/** A compact card: 16 px top and bottom padding, as in the kit row of four figures. */
export function StatCard({ label, value, change }: StatCardProps) {
	const { t } = useT();
	return (
		<Card className="gap-0 py-4">
			<CardContent>
				<div className="flex items-center justify-between gap-2">
					<p className="min-w-0 font-medium text-muted-foreground text-sm">
						{label}
					</p>
					{change === null ? (
						<span className="shrink-0 text-muted-foreground text-xs">
							{t("kpi.noComparison")}
						</span>
					) : (
						<ChangePill change={change} goodWhen="up" />
					)}
				</div>
				<p className="mt-2 font-numeric font-semibold text-3xl tabular-nums">
					{value}
				</p>
			</CardContent>
		</Card>
	);
}
