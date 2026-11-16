// The "Late deliveries by reason" panel of the home: the total, then one row per reason with a thin share bar.
// DispatchPage renders it beside the deliveries panel. It follows the breakdown part of the chart form "stacked".
import {
	type BreakdownSlice,
	dayCountFormat,
	type ExceptionReason,
	fillMessage,
	percentFormat,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

type LateReasonsCardProps = {
	/** Late deliveries by reason code, the largest part first. */
	slices: BreakdownSlice<ExceptionReason>[];
	/** The period of the slices, in days. The description names it. */
	days: number;
	/** Shipments delivered in the same period, on time or late. The late share divides by it. */
	deliveredCount: number;
};

/** The rows spread over the height of the panel, so it stays level with the deliveries panel. */
export function LateReasonsCard({
	slices,
	days,
	deliveredCount,
}: LateReasonsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = percentFormat(locale);
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("lateReasons.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("chart.lastDays"), {
						days: dayCountFormat(locale).format(days),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-5">
				<div className="grid gap-1.5">
					<p className="flex items-baseline gap-2">
						<span className="font-numeric font-semibold text-4xl tabular-nums leading-none">
							{number.format(total)}
						</span>
						<span className="text-muted-foreground text-sm">
							{t("lateReasons.total")}
						</span>
					</p>
					{/* No delivery in the period: no share exists, so the line is left out. */}
					{deliveredCount > 0 ? (
						<p className="text-muted-foreground text-sm tabular-nums">
							{fillMessage(t("lateReasons.share"), {
								share: percent.format(total / deliveredCount),
								delivered: number.format(deliveredCount),
							})}
						</p>
					) : null}
				</div>
				{total === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("lateReasons.empty")}
					</p>
				) : (
					<ul className="flex flex-1 flex-col justify-between gap-4">
						{slices.map((slice) => {
							const label = t(`exceptionReason.${slice.label}`);
							return (
								<li key={slice.label} className="grid gap-1.5">
									<div className="flex items-baseline justify-between gap-3 text-sm">
										<span className="font-medium">{label}</span>
										<span className="tabular-nums">
											<span className="text-muted-foreground">
												{`${percent.format(slice.value / total)} · `}
											</span>
											<span className="font-medium">
												{number.format(slice.value)}
											</span>
										</span>
									</div>
									<Progress
										value={slice.value}
										max={total}
										aria-label={label}
									/>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
