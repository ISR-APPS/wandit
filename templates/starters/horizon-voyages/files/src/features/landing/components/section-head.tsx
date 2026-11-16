// The head of a numbered section: a label with the sun square, the title, and a note on a hairline at the end side.
// CircuitsSection, LineSection, SeasonsSection, and QuoteSection render it. The note stays in sentence case.
// On the deep band, landing.css (.hz-deep) swaps the ink variables, so the same classes read on the dark ground.
import { H2, META } from "../lib/type-styles";

type SectionHeadProps = {
	/** Number and name, for example "01 — Circuits". Already translated. */
	label: string;
	title: string;
	/** Id of the title, for the aria-labelledby of the section. */
	titleId: string;
	/** One or two sentences of practical fact beside the title. */
	note: string;
};

/** Two columns from 820px: the title takes the free width, the note 330px at most. One column on a phone. */
export function SectionHead({ label, title, titleId, note }: SectionHeadProps) {
	return (
		<div
			data-reveal
			className="hz-rise mb-[clamp(34px,4.5vw,64px)] grid gap-x-[clamp(20px,4vw,64px)] gap-y-6 min-[820px]:grid-cols-[minmax(0,1fr)_minmax(0,330px)] min-[820px]:items-end"
		>
			<div>
				<p className={`${META} mb-5 flex items-center gap-3`}>
					<span
						aria-hidden="true"
						className="size-[7px] shrink-0 bg-(--hz-sun)"
					/>
					{label}
				</p>
				<h2 id={titleId} className={`${H2} text-balance`}>
					{title}
				</h2>
			</div>
			<p className="border-(--hz-hair) border-t pt-3.5 text-(--hz-ink-soft) text-[14px] leading-[1.55]">
				{note}
			</p>
		</div>
	);
}
