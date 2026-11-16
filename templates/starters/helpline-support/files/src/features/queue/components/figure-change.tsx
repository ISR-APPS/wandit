// The change line of one desk figure against the previous period of the same length.
// DeskFigureCell renders it under the value. goodWhen decides the color: a fall of reply times is good news.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { DeskFigure } from "../api/desk.queries";

// A change under 0.05 % reads as no change: no arrow and no color.
const FLAT_CHANGE = 0.0005;

type FigureChangeProps = Pick<DeskFigure, "change" | "goodWhen">;

/** The delta line of a figure: an arrow and a signed percent in the color of good or bad news, or "No earlier data". */
export function FigureChange({ change, goodWhen }: FigureChangeProps) {
	const { t, locale } = useT();
	if (change === null) {
		return (
			<p className="text-muted-foreground text-xs">{t("kpi.noComparison")}</p>
		);
	}
	const text = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	}).format(Math.abs(change) < FLAT_CHANGE ? 0 : change);
	if (Math.abs(change) < FLAT_CHANGE) {
		return (
			<p className="text-muted-foreground text-xs">
				<bdi dir="ltr">{text}</bdi>
			</p>
		);
	}
	const isRise = change > 0;
	const isGood = isRise === (goodWhen === "up");
	const Arrow = isRise ? TrendUpIcon : TrendDownIcon;
	return (
		<p
			className={cn(
				"flex items-center gap-1 text-xs",
				isGood ? "text-success" : "text-destructive",
			)}
		>
			<Arrow className="size-3.5 rtl:-scale-x-100" />
			<bdi dir="ltr" className="tabular-nums">
				{text}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</p>
	);
}
