// The head of a chapter: a brass kicker over a two-clause title whose second clause is the serif turn.
// DesignSection, NoirSection, ReviewsSection, and FaqSection render it.
import { KICKER, SECTION_TITLE } from "../lib/type-styles";

type SectionHeadProps = {
	kicker: string;
	/** First clause of the title, in the grotesk. */
	title: string;
	/** Second clause, in the brass serif italic. */
	turn: string;
	/** Id of the h2, so the section can name itself with aria-labelledby. */
	titleId?: string;
	/** Extra classes of the wrapper, for example a bottom margin. */
	className?: string;
};

/** The title breaks between the two clauses, so the rag is set by hand. */
export function SectionHead({
	kicker,
	title,
	turn,
	titleId,
	className,
}: SectionHeadProps) {
	return (
		<div className={className}>
			<p className={`${KICKER} mb-[1.2rem]`}>{kicker}</p>
			<h2 id={titleId} className={SECTION_TITLE}>
				<span className="block">{title}</span>
				<span className="lume-turn block text-[1.02em]">{turn}</span>
			</h2>
		</div>
	);
}
