// The plate of the roast feature: a steaming cup on its saucer, with a spoon, in halftone dots and ink lines.
// RoastSection renders it inside a PressPlate. It fills from the bank of halftone-defs.tsx.
import { useT } from "~/shared/i18n";
import { HALFTONE } from "./halftone-defs";

/** The cup. The shade side and the coffee take the darker screens. */
export function CupPlate() {
	const { t } = useT();
	return (
		<svg
			viewBox="0 0 460 380"
			role="img"
			aria-label={t("roast.plateLabel")}
			className="block h-auto w-full text-foreground"
			fill="none"
			stroke="currentColor"
		>
			<ellipse
				cx="230"
				cy="316"
				rx="158"
				ry="28"
				fill={HALFTONE.light}
				strokeWidth="2.5"
			/>
			<path
				d="M132 168 h180 l-16 124 a24 24 0 0 1 -24 20 h-100 a24 24 0 0 1 -24 -20 z"
				className="fill-background"
				strokeWidth="2.5"
			/>
			<path
				d="M236 168 h76 l-16 124 a24 24 0 0 1 -24 20 h-40 z"
				fill={HALFTONE.mid}
				strokeWidth="2"
			/>
			<ellipse
				cx="222"
				cy="168"
				rx="90"
				ry="16"
				fill={HALFTONE.dense}
				strokeWidth="2.5"
			/>
			<path d="M312 190 h26 a26 26 0 0 1 0 52 h-34" strokeWidth="2.5" />
			<path d="M176 132 c-8 -14 8 -20 0 -36" strokeWidth="2.5" />
			<path d="M214 124 c-9 -16 9 -22 0 -40" strokeWidth="2.5" />
			<path d="M252 132 c-8 -14 8 -20 0 -36" strokeWidth="2.5" />
			<ellipse
				cx="360"
				cy="330"
				rx="34"
				ry="8"
				className="fill-background"
				strokeWidth="2"
			/>
			<line x1="360" y1="326" x2="404" y2="298" strokeWidth="2.5" />
		</svg>
	);
}
