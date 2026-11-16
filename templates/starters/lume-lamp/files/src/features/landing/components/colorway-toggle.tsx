// The colorway switch of the hero: two radios in a pill, with a thumb that slides under the chosen one.
// HeroStage renders it across the bottom edge of the frame. LandingPage owns the colorway state.
import { useT } from "~/shared/i18n";
import { COLORWAYS, type Colorway } from "../lib/colorways";

type ColorwayToggleProps = {
	colorway: Colorway;
	onColorwayChange: (colorway: Colorway) => void;
};

/** Real radio inputs, so the arrow keys and screen readers work. landing.css draws the thumb. */
export function ColorwayToggle({
	colorway,
	onColorwayChange,
}: ColorwayToggleProps) {
	const { t } = useT();
	return (
		<fieldset className="lume-toggle lume-enter-soft grid grid-cols-2 [--lume-delay:1.15s]">
			<legend className="sr-only">{t("colorway.legend")}</legend>
			{COLORWAYS.map((option) => (
				<label
					key={option.id}
					className="relative z-[1] flex min-h-11 cursor-pointer items-center justify-center gap-[0.55em] rounded-full px-2 font-medium text-[0.82rem] tracking-[0.04em]"
				>
					<input
						type="radio"
						name="hero-colorway"
						value={option.id}
						checked={option.id === colorway}
						onChange={() => onColorwayChange(option.id)}
						className="pointer-events-none absolute opacity-0"
					/>
					<span
						aria-hidden="true"
						className={`lume-chip lume-chip-${option.id} size-[0.85em] flex-none rounded-full`}
					/>
					{t(option.nameKey)}
				</label>
			))}
		</fieldset>
	);
}
