// The delta line of a figure: an arrow, a signed change in a good or bad color, then a short muted context.
// The home stat cards and the targets KPI cards render it under their value.
// A ratio shows "+3.6%". A change of a percent figure shows "-0.9 pts". No earlier data never shows "0%".
import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { fillMessage } from "../lib/format";

// One decimal shows 0.05 % (or 0.05 pts) and more. A smaller change shows no arrow and no color.
const FLAT_CHANGE = 0.0005;

type ChangeLineProps = {
	/** The change against the earlier period, read as `kind` says. null shows "No earlier data". */
	change: number | null;
	/** "ratio": 0.12 is +12 %. "points": the difference of two ratios, 0.009 is +0.9 pts. */
	kind: "ratio" | "points";
	/** "down" for a figure where a fall is good news, for example cancellations. */
	goodWhen: "up" | "down";
	/** What the change compares, for example "against the 30 days before". It shows only when a change exists. */
	context: string;
	className?: string;
};

/** One text-xs row under a KPI value. Pass a className to make it larger. */
export function ChangeLine({
	change,
	kind,
	goodWhen,
	context,
	className,
}: ChangeLineProps) {
	const { t, locale } = useT();
	if (change === null) {
		return (
			<p className={cn("text-muted-foreground text-xs", className)}>
				{t("kpi.noComparison")}
			</p>
		);
	}
	const signed = {
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	} as const;
	const label =
		kind === "points"
			? fillMessage(t("kpi.points"), {
					// A ratio difference of 0.009 is 0.9 percentage points.
					value: new Intl.NumberFormat(locale, signed).format(change * 100),
				})
			: new Intl.NumberFormat(locale, { ...signed, style: "percent" }).format(
					change,
				);
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	// The arrow shows the direction. The color shows good or bad news, from goodWhen.
	const isGood = change > 0 === (goodWhen === "up");
	const ArrowIcon = change < 0 ? ArrowDownIcon : ArrowUpIcon;
	return (
		<p
			className={cn(
				"flex flex-wrap items-center gap-x-1 text-muted-foreground text-xs",
				className,
			)}
		>
			<span
				className={cn(
					"flex items-center gap-0.5 font-medium",
					isFlat ? "" : isGood ? "text-success" : "text-destructive",
				)}
			>
				{isFlat ? null : <ArrowIcon className="size-3" />}
				{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
				<bdi dir="ltr" className="tabular-nums">
					{label}
				</bdi>
			</span>
			<span>{context}</span>
		</p>
	);
}
