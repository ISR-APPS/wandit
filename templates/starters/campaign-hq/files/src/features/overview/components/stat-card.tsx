// One figure of the top row of the home: the label and the delta badge on one line, the value under them.
// OverviewPage renders four of them. The card is compact (py-4), as the stat row of the kit analytics page.
import { DeltaBadge } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import type { OverviewFigure } from "../api/overview.queries";
import { formatFigureValue } from "../lib/figure-value";

type StatCardProps = {
	figure: OverviewFigure;
};

/** The label is a dt and the value a dd, so a screen reader reads them as one pair. */
export function StatCard({ figure }: StatCardProps) {
	const { t, locale } = useT();
	return (
		<Card className="py-4">
			<CardContent>
				<dl className="grid gap-2">
					<div className="flex items-center justify-between gap-2">
						<dt className="font-medium text-muted-foreground text-sm">
							{t(figure.labelKey)}
						</dt>
						<DeltaBadge change={figure.change} goodWhen={figure.goodWhen} />
					</div>
					{/* The wide display font fits a 9-digit value in a quarter row only from 64rem. */}
					<dd className="font-numeric font-semibold @5xl/main:text-3xl text-2xl tabular-nums">
						{formatFigureValue(figure, locale)}
					</dd>
				</dl>
			</CardContent>
		</Card>
	);
}
