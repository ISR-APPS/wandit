// A signed percent change in the color of its meaning: green for good news, red for bad news.
// The KPI cards and the team highlight rows of the home render it. No earlier data shows a muted sentence, never "0%".
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type ChangeTextProps = {
	/** Ratio against the period before: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
	/** "down" for a figure where a fall is good news, for example overdue tasks or a cycle time. */
	goodWhen: "up" | "down";
};

/** The percent sits in a bdi with dir="ltr", so the sign stays before the number in Arabic. */
export function ChangeText({ change, goodWhen }: ChangeTextProps) {
	const { t, locale } = useT();
	if (change === null) {
		return <span>{t("kpi.noComparison")}</span>;
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
		minimumFractionDigits: 1,
		signDisplay: "exceptZero",
	});
	const isGood = goodWhen === "up" ? change > 0 : change < 0;
	return (
		<bdi
			dir="ltr"
			className={cn(
				"font-medium",
				change === 0 ? "" : isGood ? "text-success" : "text-destructive",
			)}
		>
			{percent.format(change)}
		</bdi>
	);
}
