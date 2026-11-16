// One chunky meter of the results section: a label with its context word, then a fat bar with a % cap.
// ResultsSection renders four. useBlockPop fills the bar and counts the cap when the meter enters the screen.
// The cap text comes from the `results.percent` message, so a locale can write "92 %".
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type ResultMeterProps = {
	label: string;
	/** The micro context at the end of the label row, for example "162 enrolled in year 1". */
	context: string;
	/** The rate, 0 to 100. */
	percent: number;
	/** Navy or sky fill. The section alternates them. */
	tone: "navy" | "sky";
};

/** 34px bar (30px under 900px) on a white track. The width is the real rate, also with no script. */
export function ResultMeter({
	label,
	context,
	percent,
	tone,
}: ResultMeterProps) {
	const { t } = useT();
	const capFormat = t("results.percent");
	return (
		<li data-pop="" className="cn-meter">
			<div className="mb-2 flex items-baseline justify-between gap-3.5">
				<span className="font-display font-semibold text-[clamp(1rem,1.2vw,1.12rem)] tracking-[-0.014em]">
					{label}
				</span>
				<span className="whitespace-nowrap text-(--cn-sky-deep) text-[0.75rem]">
					{context}
				</span>
			</div>
			<div className="relative h-7.5 overflow-hidden rounded-full bg-card min-[900px]:h-8.5">
				<span
					style={{ width: `${percent}%` }}
					className={cn(
						"cn-meter-fill absolute inset-y-0 start-0 flex min-w-16 items-center justify-end rounded-full pe-1.5",
						tone === "navy" ? "bg-foreground" : "bg-(--cn-sky)",
					)}
				>
					<span
						data-count={percent}
						data-format={capFormat}
						className="rounded-full bg-card px-3 py-1 font-bold font-display text-[0.8125rem] tabular-nums leading-none tracking-[-0.01em]"
					>
						{capFormat.replace("{value}", String(percent))}
					</span>
				</span>
			</div>
		</li>
	);
}
