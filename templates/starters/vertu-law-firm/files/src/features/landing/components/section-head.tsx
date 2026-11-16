// The head of every section after the hero: one 38px tab riding a full-width brass rule, and a note at the end side.
// Each section file renders it first. The note names the clause range of the section ("Art. 5 — ...").
import { type TranslationKey, useT } from "~/shared/i18n";
import { DossierTab } from "./dossier-tab";

type SectionHeadProps = {
	/** The text of the tab: the section name. */
	tab: TranslationKey;
	/** The short note at the end of the rule. */
	note: TranslationKey;
};

/** The note stays on the same row as the tab on a phone. It wraps to two balanced lines there, with no lone word. */
export function SectionHead({ tab, note }: SectionHeadProps) {
	const { t } = useT();
	return (
		<div
			data-reveal
			className="vt-line mb-[clamp(2.2rem,4vw,3.4rem)] flex items-end gap-4 border-b sm:gap-5"
		>
			<DossierTab size="section" className="shrink-0">
				{t(tab)}
			</DossierTab>
			<p className="ms-auto min-w-0 text-balance pb-2.5 text-end text-(--vt-ink-50) text-[10.5px] leading-snug tracking-[0.06em] sm:text-xs">
				{t(note)}
			</p>
		</div>
	);
}
