// One row of the practices ledger. PracticesSection renders four of them.
// From 900px the meta column sits at the end edge with its numerals in line.
// Below 900px the meta moves under the prose as a wrap of chips, never into the numeral column.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Practice } from "../lib/content";
import { ROW_TITLE, SOFT } from "../lib/type-styles";

type PracticeRowProps = {
	practice: Practice;
	/** The two-digit place of the row in the ledger, for example "02". */
	numeral: string;
};

/** A hairline row. Hover and keyboard focus tint it and move the meta column 4px to the end. */
export function PracticeRow({ practice, numeral }: PracticeRowProps) {
	const { t } = useT();
	return (
		<article
			data-reveal
			className="group grid grid-cols-[2.6rem_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-foreground/12 border-b py-6 ps-1.5 pe-3 transition-colors duration-[180ms] ease-linear focus-within:bg-(--cap-tint) hover:bg-(--cap-tint) min-[56.25rem]:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,18rem)] min-[56.25rem]:items-baseline min-[56.25rem]:gap-x-8 min-[56.25rem]:px-3 min-[56.25rem]:py-[1.9rem]"
		>
			<p className="pt-2 font-semibold text-[0.6875rem] text-primary tabular-nums tracking-[0.1em]">
				{numeral}
			</p>
			<div>
				<h3 className={cn(ROW_TITLE, "mb-2")}>
					{t(`practices.${practice.id}.title`)}
				</h3>
				<p className={cn(SOFT, "max-w-[62ch] text-[0.96875rem]")}>
					{t(`practices.${practice.id}.body`)}
				</p>
			</div>
			<div
				className={cn(
					SOFT,
					"col-start-2 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] tabular-nums transition-transform duration-[180ms] ease-linear min-[56.25rem]:col-start-3 min-[56.25rem]:mt-0 min-[56.25rem]:flex-col min-[56.25rem]:flex-nowrap min-[56.25rem]:items-end min-[56.25rem]:gap-1 min-[56.25rem]:text-end min-[56.25rem]:group-hover:translate-x-1 min-[56.25rem]:group-focus-within:translate-x-1 min-[56.25rem]:rtl:group-hover:-translate-x-1 min-[56.25rem]:rtl:group-focus-within:-translate-x-1",
				)}
			>
				<b className="font-semibold text-foreground">
					{t(`practices.${practice.id}.count`)}
				</b>
				<span>{t(`practices.${practice.id}.sectors`)}</span>
				<span className="flex flex-wrap gap-1.5 min-[56.25rem]:mt-1">
					{practice.tags.map((tag) => (
						<span
							key={tag}
							className="border border-foreground/18 px-2 py-1 font-semibold text-[0.625rem] text-primary uppercase leading-[1.4] tracking-[0.1em]"
						>
							{t(tag)}
						</span>
					))}
				</span>
			</div>
		</article>
	);
}
