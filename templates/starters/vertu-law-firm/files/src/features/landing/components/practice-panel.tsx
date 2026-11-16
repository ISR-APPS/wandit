// One panel of the practice drawer: the counter, the area statement, its four services, and the lead partner.
// PracticesSection renders five of them in a column. useActivePractice finds them by [data-practice-panel].
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PRACTICE_ITEMS, type PracticeId } from "../lib/content";
import { LABEL } from "../lib/type-styles";

type PracticePanelProps = {
	id: PracticeId;
	/** The place of the panel, from 0. The counter shows it as "01". */
	index: number;
	/** The count of panels, shown as "of 05" in the counter. */
	total: number;
};

/** On a wide screen each panel is at least two thirds of the screen high, so the drawer has time to follow. */
export function PracticePanel({ id, index, total }: PracticePanelProps) {
	const { t } = useT();
	const number = String(index + 1).padStart(2, "0");
	return (
		<article
			id={`practice-${id}`}
			data-practice-panel
			data-reveal="end"
			aria-labelledby={`practice-${id}-title`}
			className="vt-line scroll-mt-24 border-t pt-9 pb-12 first:border-t-0 first:pt-0 lg:min-h-[68vh]"
		>
			<p className="mb-5 flex items-baseline gap-3">
				<span className="font-display text-(--vt-brass) text-[clamp(1.5rem,2.4vw,2.1rem)] tabular-nums leading-none">
					{number}
				</span>
				<span className={cn(LABEL, "text-(--vt-ink-50) leading-snug")}>
					{t("practices.counter")
						.replace("{total}", String(total).padStart(2, "0"))
						.replace("{name}", t(`practices.${id}.name`))}
				</span>
			</p>
			<h3
				id={`practice-${id}-title`}
				className="mb-4 max-w-[22ch] font-display font-normal text-[clamp(1.7rem,3vw,2.55rem)] leading-[1.12] tracking-[-0.012em]"
			>
				{t(`practices.${id}.title`)}
			</h3>
			<p className="mb-7 max-w-[56ch] text-(--vt-ink-70)">
				{t(`practices.${id}.body`)}
			</p>
			<ol className="vt-faint border-t">
				{PRACTICE_ITEMS.map((item, itemIndex) => (
					<li
						key={item}
						className="vt-faint flex items-baseline gap-4 border-b py-3 text-(--vt-ink-70) text-[0.96rem]"
					>
						<span
							className={cn(
								LABEL,
								"w-8 shrink-0 text-(--vt-brass) text-[10.5px] tabular-nums",
							)}
						>
							{String(itemIndex + 1).padStart(2, "0")}
						</span>
						{t(`practices.${id}.${item}`)}
					</li>
				))}
			</ol>
			<p className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-(--vt-ink-50) text-xs tracking-[0.05em]">
				<span>
					{t("practices.leadPartner").replace(
						"{name}",
						t(`practices.${id}.partner`),
					)}
				</span>
				<span>{t(`practices.${id}.delay`)}</span>
			</p>
		</article>
	);
}
