// One KPI card of the plans page: the label, a delta badge at the end of the head, and the value under them.
// PlansPage renders four of them above the plan table. It follows the KPI cards of the kit products page.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";

// One decimal shows 0.05 % and more. A smaller change shows no badge, because "0%" tells nothing.
const FLAT_CHANGE = 0.0005;

type PlanKpiCardProps = {
	label: string;
	/** The formatted value, for example "$9,850" or "142". */
	value: string;
	/** Ratio against 30 days ago: 0.12 is +12 %. null (no earlier data) or a flat change hides the badge. */
	change: number | null;
	/** "down" for a figure where a fall is good news, for example frozen members. */
	goodWhen: "up" | "down";
};

/** The badge names the change in words for screen readers, so the color is never the only mark. */
export function PlanKpiCard({
	label,
	value,
	change,
	goodWhen,
}: PlanKpiCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	// The sign gives the direction. The color gives good or bad news, from goodWhen.
	const isGood = change !== null && change > 0 === (goodWhen === "up");
	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				{change === null || Math.abs(change) < FLAT_CHANGE ? null : (
					<CardAction>
						{/* Bad news has no tinted kit variant, so it follows the recipe of the success variant. */}
						<Badge
							variant={isGood ? "success" : "outline"}
							className={
								isGood
									? undefined
									: "border-destructive/25 bg-destructive/12 text-destructive"
							}
						>
							{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
							<bdi dir="ltr" className="tabular-nums">
								{percent.format(change)}
							</bdi>
							<span className="sr-only">{t("plans.vs30Days")}</span>
						</Badge>
					</CardAction>
				)}
				<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{value}
				</p>
			</CardHeader>
		</Card>
	);
}
