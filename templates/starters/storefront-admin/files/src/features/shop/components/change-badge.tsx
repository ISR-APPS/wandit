// The signed percent of a change, colored by good or bad news: "+6.1%" in green, "-1.2%" in red.
// The home stat cards and region rows, the revenue card, and the product figures render it.
// "badge" draws an outline pill, as the kit beside a value. "text" draws the bare colored percent.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";

// One decimal shows 0.05 % and more. A smaller change reads "0%", so it gets no color.
const FLAT_CHANGE = 0.0005;

type ChangeBadgeProps = {
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null renders nothing. */
	change: number | null;
	/** "down" for a figure where a fall is good news, for example discounts given. */
	goodWhen: "up" | "down";
	/** "badge" is an outline pill. "text" is the bare percent in a span. */
	look: "badge" | "text";
	className?: string;
};

/** No earlier data (null) shows no percent at all, never "0%". The caller can show a text in its place. */
export function ChangeBadge({
	change,
	goodWhen,
	look,
	className,
}: ChangeBadgeProps) {
	const { t, locale } = useT();
	if (change === null) {
		return null;
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	const isGood = change > 0 === (goodWhen === "up");
	const tone = isFlat
		? "text-muted-foreground"
		: isGood
			? "text-success"
			: "text-destructive";
	const content = (
		<>
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{percent.format(change)}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</>
	);
	return look === "badge" ? (
		<Badge variant="outline" className={cn(tone, className)}>
			{content}
		</Badge>
	) : (
		<span className={cn("font-medium text-sm", tone, className)}>
			{content}
		</span>
	);
}
