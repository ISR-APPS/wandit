// The small bordered tag of a program family: Fund, Muay, Spar, Youth, or Open.
// day-card.tsx and the legend of weekly-bill-section.tsx render it. landing.css holds the tag colors.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { ClassTag } from "../lib/content";

/** The color class (landing.css) and the short text of each program tag. */
const TAG: Record<ClassTag, { className: string; label: TranslationKey }> = {
	fund: { className: "sp-tag-fund", label: "bill.tagFund" },
	muay: { className: "sp-tag-muay", label: "bill.tagMuay" },
	spar: { className: "sp-tag-spar", label: "bill.tagSpar" },
	youth: { className: "sp-tag-youth", label: "bill.tagYouth" },
	open: { className: "sp-tag-open", label: "bill.tagOpen" },
};

/** A tag chip. Its text has at most five letters, so it fits beside a class name at 375px. */
export function ClassTagChip({ tag }: { tag: ClassTag }) {
	const { t } = useT();
	return (
		<span
			className={cn(
				"inline-block shrink-0 border px-1.5 py-1 font-bold text-[0.58rem] uppercase leading-none tracking-[0.16em]",
				TAG[tag].className,
			)}
		>
			{t(TAG[tag].label)}
		</span>
	);
}
