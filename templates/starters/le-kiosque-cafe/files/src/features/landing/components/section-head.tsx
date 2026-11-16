// The head of an inside page of the paper: a 4px ink bar, the page number, the title, and a caps note.
// The roast, menu, archives, newsroom, and letters sections render it first. The bar wipes in from the start side.

import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";

/** One section head. The title is the h2 of the section; `titleId` labels the section. */
export function SectionHead({
	titleId,
	pageKey,
	titleKey,
	noteKey,
}: {
	/** The id of the h2. The section points at it with aria-labelledby. */
	titleId: string;
	/** The page line, for example "Page 2". */
	pageKey: TranslationKey;
	titleKey: TranslationKey;
	/** The caps note at the end side of the head. */
	noteKey: TranslationKey;
}) {
	const { t } = useT();
	return (
		<div className="relative mb-[clamp(1.8rem,4vh,2.8rem)] flex flex-wrap items-baseline gap-x-6 gap-y-2 pt-3">
			<span
				aria-hidden="true"
				data-wipe
				className="ks-wipe absolute inset-x-0 top-0 h-1 bg-foreground"
			/>
			<span className="font-bold font-sans text-[0.76rem] text-primary uppercase tracking-[0.14em]">
				{t(pageKey)}
			</span>
			<h2
				id={titleId}
				className="font-display font-extrabold text-[clamp(1.55rem,3vw,2.3rem)] leading-[1.1]"
			>
				{t(titleKey)}
			</h2>
			<span className="font-sans text-[0.76rem] text-foreground/62 uppercase tracking-[0.1em] min-[640px]:ms-auto">
				{t(noteKey)}
			</span>
		</div>
	);
}
