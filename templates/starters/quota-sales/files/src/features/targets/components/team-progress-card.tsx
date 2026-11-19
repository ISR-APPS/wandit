// The first KPI card of the targets page: a ring of the team attainment and one sentence about the quarter.
// TargetsPage renders it at the start of the KPI row, before the 3 chip cards.
// The title says if the team target is met. The ring is SVG with theme stroke classes, so no chart library loads.
import {
	fillMessage,
	PACE_TEXT,
	type PaceStatus,
	percentFormat,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

// The circle of radius 15.9155 has a length of 100, so the dash length is the percent itself.
const RING_RADIUS = 15.9155;

type TeamProgressCardProps = {
	/** booked / target of the team. Above 1 when the team passed the target. */
	attainment: number;
	status: PaceStatus;
	/** "Q4 2026". */
	quarterLabel: string;
	/** True for a quarter that ended before today. */
	isClosed: boolean;
	/** Weekdays left in the quarter, today included. 0 for a closed quarter. */
	sellingDaysLeft: number;
};

/** The ring caps at a full circle. The sentence gives the exact percent, so the ring is never the only mark. */
export function TeamProgressCard({
	attainment,
	status,
	quarterLabel,
	isClosed,
	sellingDaysLeft,
}: TeamProgressCardProps) {
	const { t, locale } = useT();
	const percent = percentFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const shown = Math.min(Math.max(attainment, 0), 1) * 100;
	const isMet = attainment >= 1;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="font-semibold text-xl leading-tight">
					{t(isMet ? "targets.progress.met" : "targets.progress.open")}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<div className="relative size-16 shrink-0">
					<svg
						viewBox="0 0 36 36"
						className="size-16 -rotate-90 rtl:-scale-x-100"
						aria-hidden="true"
					>
						<circle
							cx="18"
							cy="18"
							r={RING_RADIUS}
							className="fill-none stroke-muted"
							strokeWidth="3"
						/>
						<circle
							cx="18"
							cy="18"
							r={RING_RADIUS}
							className="fill-none stroke-primary"
							strokeWidth="3"
							strokeLinecap="round"
							strokeDasharray={`${shown} 100`}
						/>
					</svg>
					<span className="absolute inset-0 flex items-center justify-center font-semibold text-xs tabular-nums">
						{percent.format(attainment)}
					</span>
				</div>
				<p className="text-muted-foreground text-sm">
					{fillMessage(
						t(isClosed ? "targets.progress.closed" : "targets.progress.text"),
						{
							quarter: quarterLabel,
							days: number.format(sellingDaysLeft),
						},
					)}{" "}
					<span className={cn("font-medium", PACE_TEXT[status])}>
						{fillMessage(t("targets.progress.reached"), {
							value: percent.format(attainment),
						})}
					</span>
				</p>
			</CardContent>
		</Card>
	);
}
