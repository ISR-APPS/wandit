// The exploded burger: the photo of the Double cut into six slices, each with a numbered label.
// ExplodedSection renders it in its stage. It reads the cuts of lib/content.ts.
// landing.css draws the slices and moves them with --sc-progress.
import type { CSSProperties } from "react";
import { useT } from "~/shared/i18n";
import { BURGER_LAYERS } from "../lib/content";

/** The CSS variables of one slice. landing.css reads them in `.sc-layer` and `.sc-layer-tag`. */
type LayerStyle = CSSProperties & {
	/** Top edge of the slice, as a share of the photo height. */
	"--layer-top": number;
	/** Bottom edge of the slice, as a share of the photo height. */
	"--layer-bottom": number;
	/** Position of the slice from the top, from 0. A closed slice moves up by this count of gaps. */
	"--layer-index": number;
	/** The scroll progress, from 0 to 1, at which the label starts to show. */
	"--label-start": number;
};

/** Progress at which the first label starts. The burger opens a little before the first name lands. */
const FIRST_LABEL_START = 0.11;
/** Progress between the starts of two labels. Six labels end at 0.89, before the stack is fully open. */
const LABEL_STEP = 0.124;

/** One image for a screen reader: the label reads the layers from top to bottom. */
export function ExplodedStack() {
	const { t } = useT();
	return (
		<div role="img" aria-label={t("exploded.stackLabel")} className="sc-stack">
			{BURGER_LAYERS.map((layer, index) => {
				const layerStyle: LayerStyle = {
					"--layer-top": layer.top,
					"--layer-bottom": layer.bottom,
					"--layer-index": index,
					"--label-start": FIRST_LABEL_START + index * LABEL_STEP,
				};
				return (
					<div key={layer.id} className="sc-layer" style={layerStyle}>
						<div className="sc-layer-photo" />
						<span className="sc-layer-label">
							<span className="sc-layer-tag">
								<b className="font-display font-normal text-[clamp(1rem,1.5vw,1.3rem)] leading-none">
									{String(index + 1).padStart(2, "0")}
								</b>
								<span className="font-semibold text-[clamp(11px,1.05vw,14px)] uppercase leading-[1.22] tracking-[0.04em]">
									{t(layer.labelKey)}
								</span>
							</span>
						</span>
					</div>
				);
			})}
		</div>
	);
}
