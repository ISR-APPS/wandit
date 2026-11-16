// The edition meter under the order card: the reserved count, the count that remains, and a 3px brass bar.
// ReserveSection renders it. useCountUp counts the number up when the meter comes into view.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useCountUp } from "../hooks/use-count-up";
import { EDITION_SIZE, RESERVED_COUNT } from "../lib/offer";

/** Scarcity as a fact, never as a countdown. The bar width follows the counted number. */
export function EditionMeter() {
	const { t } = useT();
	const meterRef = useRef<HTMLDivElement>(null);
	const shown = useCountUp(meterRef, RESERVED_COUNT);
	// Percent of the edition that is reserved, for the bar width.
	const filledPercent = (shown / EDITION_SIZE) * 100;
	return (
		<div ref={meterRef} className="mt-[1.6rem]">
			<p className="flex items-baseline justify-between gap-4 text-[0.8rem] text-foreground/52 uppercase tracking-[0.1em]">
				<span>
					<b className="me-[0.35em] font-display font-medium text-[1.5rem] text-foreground normal-case tabular-nums tracking-normal">
						{shown}
					</b>
					{t("reserve.reserved").replace("{size}", String(EDITION_SIZE))}
				</span>
				<span className="tabular-nums">
					{EDITION_SIZE - shown} {t("reserve.remain")}
				</span>
			</p>
			<div
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={EDITION_SIZE}
				aria-valuenow={RESERVED_COUNT}
				aria-label={t("reserve.meterLabel")}
				className="mt-[0.7rem] h-[3px] overflow-hidden rounded-[2px] bg-foreground/12"
			>
				<div
					className="lume-meter-fill h-full rounded-[2px]"
					style={{ width: `${filledPercent}%` }}
				/>
			</div>
			<p className="mt-[0.8rem] text-[0.8rem] text-foreground/52">
				{t("reserve.editionNote")}
			</p>
		</div>
	);
}
