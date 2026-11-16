// The legend of the heat form: "Less", the 5 step squares, and "More".
// SolvedCard renders it under the calendar or the strip. Screen readers skip it: the label of the heat says it all.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { HEAT_STEPS } from "../lib/heat-steps";

/** One line, at the start side under the heat. */
export function HeatLegend() {
	const { t } = useT();
	return (
		<div
			aria-hidden="true"
			className="flex items-center gap-1.5 text-muted-foreground text-xs"
		>
			<span className="me-1">{t("chart.less")}</span>
			{HEAT_STEPS.map((step) => (
				<span key={step} className={cn("size-[12px] rounded-xs", step)} />
			))}
			<span className="ms-1">{t("chart.more")}</span>
		</div>
	);
}
