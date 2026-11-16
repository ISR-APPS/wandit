// The "Seconds out" rule between two rounds: a double line on each side of a small caption.
// landing-page.tsx renders one between each pair of sections.
import { useT } from "~/shared/i18n";
import { Star } from "./star";

type RoundDividerProps = {
	/** The number of the round that follows. */
	nextRound: number;
	/** The last divider announces the championship rounds. */
	isChampionship?: boolean;
};

/** A decorative divider. Screen readers skip it; the section headings carry the structure. */
export function RoundDivider({
	nextRound,
	isChampionship = false,
}: RoundDividerProps) {
	const { t } = useT();
	return (
		<div
			aria-hidden="true"
			className="sp-gutter mx-auto flex max-w-7xl items-center gap-5 py-2"
		>
			<span className="sp-rule flex-1 opacity-60" />
			<span className="sp-faint whitespace-nowrap font-bold text-[0.62rem] uppercase tracking-[0.32em]">
				{isChampionship ? t("site.championshipRounds") : t("site.secondsOut")}
				<Star className="sp-sep text-primary" />
				{t("site.roundLabel")} {nextRound}
			</span>
			<span className="sp-rule flex-1 opacity-60" />
		</div>
	);
}
