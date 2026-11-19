// The first card of the KPI row of the leads page, in the "target" layout:
// a title that says if the answer target is met, a ring with the share, and one sentence.
// LeadsPage renders it with the answer share of the chosen period.
import { ANSWER_TARGET_HOURS, fillMessage } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { ANSWER_GOAL_SHARE } from "../lib/lead-stats";

// The ring is an SVG circle of radius 16 in a 40 x 40 box. Its length is 2 π r.
const RING_RADIUS = 16;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

type AnswerTargetCardProps = {
	/** The share of the answered leads of the period with an answer inside the target, from 0 to 1. null with no answer. */
	share: number | null;
	/** Count of the leads of the period with an answer. */
	answeredCount: number;
};

/** The ring fills to the share. The title is green when the share reaches the goal of the agency. */
export function AnswerTargetCard({
	share,
	answeredCount,
}: AnswerTargetCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const number = new Intl.NumberFormat(locale);
	const isMet = share !== null && share >= ANSWER_GOAL_SHARE;
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">
					{share === null
						? t("leads.target.noData")
						: isMet
							? t("leads.target.met")
							: t("leads.target.missed")}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<svg
					viewBox="0 0 40 40"
					className="size-16 shrink-0 -rotate-90"
					aria-hidden="true"
				>
					<circle
						cx="20"
						cy="20"
						r={RING_RADIUS}
						fill="none"
						strokeWidth="3"
						className="stroke-muted"
					/>
					<circle
						cx="20"
						cy="20"
						r={RING_RADIUS}
						fill="none"
						strokeWidth="3"
						strokeLinecap="round"
						strokeDasharray={RING_LENGTH}
						strokeDashoffset={RING_LENGTH * (1 - (share ?? 0))}
						className={cn(isMet ? "stroke-success" : "stroke-warning")}
					/>
					<text
						x="20"
						y="20"
						textAnchor="middle"
						dominantBaseline="central"
						transform="rotate(90 20 20)"
						className="fill-foreground font-semibold text-[0.5rem]"
					>
						{share === null ? "–" : percent.format(share)}
					</text>
				</svg>
				<p className="text-muted-foreground text-sm">
					{share === null
						? t("leads.target.noAnswers")
						: fillMessage(t("leads.target.detail"), {
								share: percent.format(share),
								count: number.format(answeredCount),
								hours: number.format(ANSWER_TARGET_HOURS),
								goal: percent.format(ANSWER_GOAL_SHARE),
							})}
				</p>
			</CardContent>
		</Card>
	);
}
