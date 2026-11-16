// The head row of a section: the caps label and the heading on the start side, the lede on the end side.
// The programmes, timetable, campus, and FAQ sections render it. Under 820px the two parts stack.
import type { ReactNode } from "react";
import { EYEBROW, H2 } from "../lib/type-styles";

type SectionHeadProps = {
	/** The id of the h2. The section points to it with aria-labelledby. */
	headingId: string;
	eyebrow: string;
	title: string;
	/** The end column: a lede paragraph or a fact plate. */
	aside: ReactNode;
};

/** Two columns at 1.08fr / 0.92fr, aligned to the bottom, as the campus world sets. */
export function SectionHead({
	headingId,
	eyebrow,
	title,
	aside,
}: SectionHeadProps) {
	return (
		<div
			data-stagger=""
			className="mb-[clamp(30px,4vw,54px)] grid items-start gap-[18px] min-[820px]:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] min-[820px]:items-end min-[820px]:gap-[clamp(20px,3vw,56px)]"
		>
			<div data-pop="" className="min-w-0">
				<span className={`${EYEBROW} mb-3.5`}>{eyebrow}</span>
				<h2 id={headingId} className={H2}>
					{title}
				</h2>
			</div>
			<div data-pop="" className="min-w-0">
				{aside}
			</div>
		</div>
	);
}
