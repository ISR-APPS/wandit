// The rubber stamp that opens a section: "ROUND" over its number, in a rough crimson ring.
// round-header.tsx renders it. landing.css slams it down when use-in-view.ts reports the entrance.
import { useT } from "~/shared/i18n";
import { useInView } from "../hooks/use-in-view";

/** A decorative stamp. `round` is the number of the section, 1 to 7. */
export function RoundStamp({ round }: { round: number }) {
	const { t } = useT();
	const { ref, phase } = useInView();
	return (
		<div
			ref={ref}
			data-reveal={phase}
			aria-hidden="true"
			className="sp-stamp sp-grit relative grid size-20 shrink-0 place-content-center text-center sm:size-27"
		>
			<span className="block font-bold text-[0.5rem] uppercase tracking-[0.3em] sm:text-[0.6rem]">
				{t("site.roundLabel")}
			</span>
			<span className="block font-display font-extrabold text-3xl leading-none sm:text-[2.7rem]">
				{round}
			</span>
		</div>
	);
}
