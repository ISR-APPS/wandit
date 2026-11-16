// One row of the schedule of missions: number, drawn symbol, designation, content, and fees in mono.
// MissionsSection renders one row for each entry of MISSIONS. The row with a fee note gets the red pencil ring.
// The symbol and the ring plot when the row scrolls into view; the row rises at the same time.
import { useT } from "~/shared/i18n";
import type { Mission } from "../lib/content";
import { BODY } from "../lib/styles";
import { MissionSymbol } from "./mission-symbol";

type MissionRowProps = {
	mission: Mission;
};

/** Five columns from 860px. On a phone the text and the fees move under the designation. */
export function MissionRow({ mission }: MissionRowProps) {
	const { t } = useT();
	return (
		<div
			data-reveal
			className="ns-mission ns-figure ns-rise grid grid-cols-[2.25rem_3rem_1fr] items-center gap-x-4 gap-y-2.5 border-foreground/20 border-b py-6 transition-colors duration-150 ease-linear hover:bg-card/85 min-[53.75rem]:grid-cols-[4rem_5.25rem_1.1fr_1.6fr_13rem] min-[53.75rem]:gap-x-5"
		>
			<span className="font-display text-sm tabular-nums">
				{mission.number}
			</span>
			<MissionSymbol symbol={mission.symbol} />
			<h3 className="ns-title font-bold text-[1.15rem] leading-snug tracking-[-0.01em]">
				{t(mission.name)}
			</h3>
			<p
				className={`${BODY} col-start-3 text-[0.95rem] leading-[1.6] min-[53.75rem]:col-start-auto`}
			>
				{t(mission.body)}
			</p>
			<div className="col-start-3 font-display text-xs tracking-[0.02em] min-[53.75rem]:col-start-auto">
				{mission.feeNote === undefined ? (
					t(mission.fee)
				) : (
					<>
						{/* The second red pencil moment: a hand ring around the fee that depends on the town.
							    The box starts 12px above the text, so the top of the ring clears the ascenders. */}
						<span className="relative inline-block px-1.5 py-0.5">
							{t(mission.fee)}
							<svg
								aria-hidden="true"
								viewBox="0 0 160 34"
								preserveAspectRatio="none"
								className="pointer-events-none absolute -inset-x-3.5 -top-3 h-[calc(100%+20px)] w-[calc(100%+28px)] overflow-visible"
							>
								<g className="plot-step plot-lines">
									<path
										className="ns-red ns-red-thin plot"
										pathLength={1}
										d="M10,28 C0,16 20,2 82,2 C140,2 160,10 154,20 C148,31 98,33 50,31 C24,30 12,30 10,28"
									/>
								</g>
							</svg>
						</span>
						<span className="plot-step plot-labels mt-2 block text-[0.625rem] text-primary tracking-[0.04em]">
							<span className="fade">{t(mission.feeNote)}</span>
						</span>
					</>
				)}
			</div>
		</div>
	);
}
