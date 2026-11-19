// The sales progress card of the home: the sales closed this quarter at the start, the homes under offer
// at the end, and one thick bar of the closed share between them. OverviewPage renders it under the featured listing.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { SalesProgress } from "../lib/series";

// Under this share, the filled part is too short for the label, so the label takes the ink color of the track.
const LABEL_ON_FILL_SHARE = 20;

type SalesProgressCardProps = {
	progress: SalesProgress;
};

/** The bar shows the closed sales against all the sales of the quarter, closed or in progress. */
export function SalesProgressCard({ progress }: SalesProgressCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = progress.closed + progress.inProgress;
	const share = total === 0 ? 0 : (progress.closed / total) * 100;

	return (
		<Card>
			<CardContent className="grid gap-4">
				<div className="flex flex-wrap justify-between gap-2">
					<p className="flex items-end gap-1.5">
						<span className="font-numeric font-semibold text-2xl tabular-nums leading-none">
							{number.format(progress.closed)}
						</span>
						<span className="text-muted-foreground text-sm">
							{t("overview.progress.closed")}
						</span>
					</p>
					<p className="flex items-end gap-1.5">
						<span className="text-muted-foreground text-sm">
							{t("overview.progress.inProgress")}
						</span>
						<span className="font-numeric font-semibold text-2xl tabular-nums leading-none">
							{number.format(progress.inProgress)}
						</span>
					</p>
				</div>
				<div className="relative">
					<Progress
						value={share}
						aria-label={t("overview.progress.label")}
						className="h-8 rounded-full bg-muted **:data-[slot=progress-indicator]:rounded-full **:data-[slot=progress-indicator]:bg-primary"
					/>
					<span
						className={cn(
							"absolute inset-0 flex items-center ps-4 text-xs",
							share >= LABEL_ON_FILL_SHARE
								? "text-primary-foreground"
								: "text-foreground",
						)}
						aria-hidden="true"
					>
						{t("overview.progress.bar")}
					</span>
				</div>
			</CardContent>
		</Card>
	);
}
