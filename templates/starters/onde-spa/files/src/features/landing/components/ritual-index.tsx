// The horizontal ritual index of the hero: three numbered circles on a hairline that draws once at load.
// HeroSection renders it at the foot of the ground plate. No stage is active yet, so no circle has a ring.
// The vertical rail of RitualSection is the only other place where the ritual numerals appear.
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { META } from "../lib/styles";

/** One stage of the index: its numeral and the keys of its name and its duration line. */
type IndexStage = {
	/** Two-digit numeral, drawn in the display face. */
	numeral: string;
	/** Key of the stage name, for example "the steam". */
	nameKey: TranslationKey;
	/** Key of the duration and temperature line. It hides below 640px; the name never does. */
	metaKey: TranslationKey;
};

/** The three stages, in the fixed order of the ritual. */
const STAGES: readonly IndexStage[] = [
	{ numeral: "01", nameKey: "hero.stage1Name", metaKey: "hero.stage1Meta" },
	{ numeral: "02", nameKey: "hero.stage2Name", metaKey: "hero.stage2Meta" },
	{ numeral: "03", nameKey: "hero.stage3Name", metaKey: "hero.stage3Meta" },
];

/** A three-column list. The hairline runs from the first circle center to the third. */
export function RitualIndex() {
	const { t } = useT();
	return (
		<div className="relative mt-[clamp(1.7rem,3.2vh,2.4rem)] border-(--onde-hair) border-t pt-(--onde-index-pad) [--onde-index-gap:clamp(0.6rem,1.4vw,1.4rem)] [--onde-index-pad:clamp(1.3rem,2.4vh,1.8rem)]">
			{/* The hairline sits behind the circles. Each circle has the ground fill, so it masks the line. */}
			<span
				aria-hidden="true"
				className="onde-index-line absolute start-6 end-[calc((100%_-_2*var(--onde-index-gap))/3_-_24px)] top-[calc(var(--onde-index-pad)+23px)] h-px bg-(--onde-hair-strong)"
			/>
			<ol
				aria-label={t("hero.indexLabel")}
				className="relative m-0 grid list-none grid-cols-3 gap-(--onde-index-gap) p-0"
			>
				{STAGES.map((stage) => (
					<li key={stage.numeral} className="grid justify-items-start gap-2">
						<span
							aria-hidden="true"
							className="grid size-12 place-items-center rounded-full border border-(--onde-hair-strong) bg-background font-display text-[0.92rem] tabular-nums tracking-[0.02em]"
						>
							{stage.numeral}
						</span>
						<span className="font-display text-[clamp(0.95rem,1.25vw,1.18rem)] leading-[1.2]">
							{t(stage.nameKey)}
						</span>
						<span
							className={cn(
								META,
								"hidden text-[0.7rem] tracking-[0.14em] sm:block",
							)}
						>
							{t(stage.metaKey)}
						</span>
					</li>
				))}
			</ol>
		</div>
	);
}
