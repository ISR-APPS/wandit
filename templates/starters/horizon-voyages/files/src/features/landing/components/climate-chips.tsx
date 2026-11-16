// The three climate chips of a destination head: temperature, season by month, and travel time.
// CircuitCard renders it. The chips are data in hairline rectangles, never badges, and only the first carries the sun dot.
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";

type ClimateChipsProps = {
	/** Exactly three keys, in the order temperature, season, access. */
	chipKeys: readonly [TranslationKey, TranslationKey, TranslationKey];
};

/** One row of three chips. The row wraps on a narrow card. */
export function ClimateChips({ chipKeys }: ClimateChipsProps) {
	const { t } = useT();
	return (
		<ul className="mt-4 mb-3.5 flex flex-wrap gap-1.5">
			{chipKeys.map((chipKey, index) => (
				<li
					key={chipKey}
					className="inline-flex items-center gap-[7px] whitespace-nowrap border border-(--hz-hair) px-[9px] py-[5px] font-semibold text-(--hz-ink-soft) text-[11px] uppercase leading-none tracking-[0.13em]"
				>
					{index === 0 ? (
						<span aria-hidden="true" className="size-1.5 bg-(--hz-sun)" />
					) : null}
					{t(chipKey)}
				</li>
			))}
		</ul>
	);
}
