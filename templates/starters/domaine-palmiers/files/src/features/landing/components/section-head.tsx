// The head of a section: a label on its rule, a title of two lines, and an optional first paragraph beside them.
// The villas, the visit, the specification, and the lots sections render it.
import { cn } from "~/shared/lib/utils";
import { H2, LEDE, RULE_LABEL } from "../lib/type-styles";

type SectionHeadProps = {
	/** The id of the <h2>. The section points at it with aria-labelledby. */
	titleId: string;
	/** The small label on the rule. Already translated. */
	label: string;
	/** The two lines of the title. The break between them is a design choice. */
	titleLines: readonly [string, string];
	/** The paragraph in the second column. Without it the head is one column. */
	lede?: string;
	/** Column shares from 1024px: "7/5" gives the title more room, "6/6" gives the paragraph more room. */
	split?: "7/5" | "6/6";
	className?: string;
};

/** From 1024px the title and the paragraph share one baseline. Below, they stack. */
export function SectionHead({
	titleId,
	label,
	titleLines,
	lede,
	split = "7/5",
	className,
}: SectionHeadProps) {
	return (
		<div
			className={cn(
				"grid gap-[clamp(1.2rem,2.4vw,2.4rem)] lg:items-end",
				lede !== undefined &&
					(split === "7/5"
						? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
						: "lg:grid-cols-2"),
				className,
			)}
		>
			<div data-reveal="lift">
				<p className={RULE_LABEL}>{label}</p>
				<h2 id={titleId} className={cn(H2, "mt-[clamp(1.2rem,2vw,1.8rem)]")}>
					<span className="block">{titleLines[0]}</span>
					<span className="block">{titleLines[1]}</span>
				</h2>
			</div>
			{lede !== undefined && (
				<p data-reveal="lift" className={LEDE}>
					{lede}
				</p>
			)}
		</div>
	);
}
