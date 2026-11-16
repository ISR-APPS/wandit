// One copy of the words of a marquee band, each word followed by a star. PromiseMarquee renders two per band.
// The second copy is hidden from screen readers; it only fills the loop.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

/** A row of words that never wraps. `isDuplicate` hides it from screen readers. */
export function MarqueeCopy({
	words,
	isDuplicate,
	starClass,
	textClass,
}: {
	words: readonly TranslationKey[];
	isDuplicate: boolean;
	/** The color class of the stars between the words. */
	starClass: string;
	/** The size class of the words. */
	textClass: string;
}) {
	const { t } = useT();
	return (
		<div
			aria-hidden={isDuplicate || undefined}
			className={cn(
				"flex shrink-0 items-center gap-9 whitespace-nowrap pe-9 font-bold font-display uppercase tracking-[0.06em]",
				textClass,
			)}
		>
			{words.map((key) => (
				<span key={key} className="flex items-center gap-9">
					{t(key)}
					<span aria-hidden="true" className={starClass}>
						✦
					</span>
				</span>
			))}
		</div>
	);
}
