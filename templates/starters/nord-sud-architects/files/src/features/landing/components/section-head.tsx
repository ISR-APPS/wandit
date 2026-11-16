// The head of a numbered section: the folio tab, the title, and an ink rule that draws to the end.
// The sheets, missions, method, and contact sections render it. The rule draws when use-scroll-reveal.ts shows it.
import { type TranslationKey, useT } from "~/shared/i18n";
import { LABEL, SECTION_TITLE } from "../lib/styles";

type SectionHeadProps = {
	/** The folio text key, for example "sheets.folio" ("PL·03"). */
	folio: TranslationKey;
	title: TranslationKey;
	/** The id of the h2. The section points at it with aria-labelledby. */
	titleId: string;
};

/** One row on a wide screen. On a phone the title takes its own line under the folio tab. */
export function SectionHead({ folio, title, titleId }: SectionHeadProps) {
	const { t } = useT();
	return (
		<div className="mb-[clamp(2rem,5vh,3.5rem)] flex flex-wrap items-center gap-x-5 gap-y-3 md:flex-nowrap">
			<span
				className={`${LABEL} shrink-0 border-[1.5px] border-foreground px-2.5 py-1 text-foreground`}
			>
				{t(folio)}
			</span>
			<h2
				id={titleId}
				className={`${SECTION_TITLE} w-full md:w-auto md:shrink-0`}
			>
				{t(title)}
			</h2>
			<div
				data-reveal
				aria-hidden="true"
				className="ns-rule hidden h-[1.5px] min-w-8 flex-1 bg-foreground md:block"
			/>
		</div>
	);
}
