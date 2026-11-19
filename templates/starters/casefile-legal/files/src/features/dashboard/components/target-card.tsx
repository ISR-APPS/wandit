// The first card of the KPI row: the billable hours of the team against the target of the period.
// DashboardPage renders it before the three KPI cards, in the place of the kit target card.
// A ring shows the share; the sentence beside it names the hours and the target, so the ring is not the only mark.
import { fillMessage, hoursFormat } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

// The ring is drawn in a 36 x 36 box. The radius keeps the 3-unit stroke inside the box.
const RING_RADIUS = 15.5;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

type TargetCardProps = {
	/** Billable hours of the period, one decimal. */
	hours: number;
	/** Billable hours that the whole team aims for in the period. 0 when the firm has no attorneys. */
	target: number;
	/** The period in words, for example "30 days". */
	period: string;
};

/** The title says whether the team reached the target. The ring stops at 100 % when the team logs more. */
export function TargetCard({ hours, target, period }: TargetCardProps) {
	const { t, locale } = useT();
	// A firm with no attorneys has a target of 0. The ring then shows 0 %, not NaN or Infinity.
	const share = target === 0 ? 0 : hours / target;
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	}).format(share);
	const hoursText = hoursFormat(locale).format(hours);
	const targetText = new Intl.NumberFormat(locale).format(target);
	const sentence = fillMessage(t("dashboard.targetText"), {
		hours: hoursText,
		target: targetText,
		period,
	});
	// The sentence has the percent as {percent}: the two parts around it keep the color only on the number.
	const [before = "", after = ""] = sentence.split("{percent}");

	return (
		<Card>
			<CardHeader>
				<CardTitle className="font-display text-xl">
					{share >= 1
						? t("dashboard.targetReached")
						: t("dashboard.targetOpen")}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<div className="relative size-20 shrink-0">
					<svg
						viewBox="0 0 36 36"
						className="size-full -rotate-90"
						aria-hidden="true"
					>
						<circle
							cx="18"
							cy="18"
							r={RING_RADIUS}
							fill="none"
							strokeWidth="3"
							className="stroke-muted"
						/>
						<circle
							cx="18"
							cy="18"
							r={RING_RADIUS}
							fill="none"
							strokeWidth="3"
							strokeLinecap="round"
							strokeDasharray={RING_LENGTH}
							strokeDashoffset={RING_LENGTH * (1 - Math.min(share, 1))}
							className="stroke-primary"
						/>
					</svg>
					<span className="absolute inset-0 flex items-center justify-center font-numeric font-semibold text-sm tabular-nums">
						{percent}
					</span>
				</div>
				<p className="text-muted-foreground text-sm">
					{before}
					<span
						className={cn(
							"font-medium tabular-nums",
							share >= 1 ? "text-success" : "text-warning",
						)}
					>
						{percent}
					</span>
					{after}
				</p>
			</CardContent>
		</Card>
	);
}
