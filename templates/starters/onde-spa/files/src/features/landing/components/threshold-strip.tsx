// The threshold strip under the hero photo: a pebble divider over one row of four practical facts.
// HeroSection renders it as its last child. It gives the first seam veil a ground to breathe on.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { WRAP } from "../lib/styles";
import { PebbleDivider } from "./pebble-divider";
import { SteamVeil } from "./steam-veil";

/** A shallow band on ground B. On a phone the facts wrap to two centered lines under the pebble. */
export function ThresholdStrip() {
	const { t } = useT();
	const facts = [
		t("threshold.hours"),
		t("threshold.days"),
		t("threshold.guests"),
		t("threshold.appointment"),
	];
	return (
		<div className="relative bg-(--onde-ground-b) py-[clamp(1.6rem,3.6vh,2.6rem)]">
			<SteamVeil kind="seam" phase={1} />
			<div className={cn(WRAP, "relative z-3")}>
				<PebbleDivider phase={0} />
				<ul
					aria-label={t("threshold.label")}
					className="m-0 mt-[clamp(0.9rem,2vh,1.5rem)] flex list-none flex-wrap items-center justify-center gap-x-[clamp(1.2rem,3vw,2.8rem)] gap-y-2 p-0 text-(--onde-ink-66) text-[0.8rem] tracking-[0.04em]"
				>
					{facts.map((fact) => (
						<li key={fact}>{fact}</li>
					))}
				</ul>
			</div>
		</div>
	);
}
