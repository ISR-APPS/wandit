// The lead plate of the front page: the shopfront of Le Kiosque in halftone dots and ink lines.
// FrontPageSection renders it inside a PressPlate. It fills from the bank of halftone-defs.tsx.
// Ink is currentColor (text-foreground); paper areas take fill-background, so the theme reaches every stroke.
import { useT } from "~/shared/i18n";
import { HALFTONE } from "./halftone-defs";

/** The shopfront: sun, sign, window with a cup, door, newspaper rack, pavement board, and the pigeon. */
export function StorefrontPlate() {
	const { t } = useT();
	return (
		<svg
			viewBox="0 0 560 430"
			role="img"
			aria-label={t("front.plateLabel")}
			className="block h-auto w-full text-foreground"
			fill="none"
			stroke="currentColor"
		>
			<circle cx="76" cy="72" r="34" fill={HALFTONE.light} stroke="none" />
			<line x1="16" y1="404" x2="544" y2="404" strokeWidth="2.5" />
			<rect
				x="138"
				y="126"
				width="286"
				height="278"
				fill={HALFTONE.light}
				strokeWidth="2.5"
			/>
			<rect
				x="120"
				y="98"
				width="322"
				height="30"
				className="fill-foreground"
				stroke="none"
			/>
			<text
				x="281"
				y="119"
				textAnchor="middle"
				className="fill-background font-bold font-sans"
				fontSize="17"
				letterSpacing="4"
				stroke="none"
			>
				{t("front.plateSign")}
			</text>
			<line x1="130" y1="128" x2="130" y2="150" strokeWidth="2.5" />
			<line x1="432" y1="128" x2="432" y2="150" strokeWidth="2.5" />
			{/* The window, with a steaming cup on the shelf. */}
			<rect
				x="160"
				y="170"
				width="152"
				height="128"
				className="fill-background"
				strokeWidth="2"
			/>
			<line x1="160" y1="262" x2="312" y2="262" strokeWidth="2" />
			<path
				d="M212 262 v-26 a10 10 0 0 1 10 -10 h18 a10 10 0 0 1 10 10 v26 z"
				fill={HALFTONE.dense}
				strokeWidth="2"
			/>
			<path d="M252 234 h12 a8 8 0 0 1 0 16 h-12" strokeWidth="2" />
			<path d="M224 216 c-5 -8 5 -12 0 -20" strokeWidth="2" />
			<path d="M238 214 c-5 -9 5 -13 0 -22" strokeWidth="2" />
			<text
				x="236"
				y="290"
				textAnchor="middle"
				className="fill-foreground font-bold font-sans"
				fontSize="13"
				letterSpacing="2.5"
				stroke="none"
			>
				{t("front.plateWindow")}
			</text>
			{/* The door. */}
			<rect
				x="338"
				y="188"
				width="64"
				height="216"
				fill={HALFTONE.mid}
				strokeWidth="2"
			/>
			<circle
				cx="348"
				cy="300"
				r="4"
				className="fill-foreground"
				stroke="none"
			/>
			<rect
				x="346"
				y="200"
				width="48"
				height="66"
				className="fill-background"
				strokeWidth="2"
			/>
			{/* The newspaper rack under the window. */}
			<rect
				x="160"
				y="318"
				width="152"
				height="86"
				fill={HALFTONE.mid}
				strokeWidth="2"
			/>
			<line x1="160" y1="352" x2="312" y2="352" strokeWidth="1.5" />
			<line x1="160" y1="378" x2="312" y2="378" strokeWidth="1.5" />
			<rect
				x="192"
				y="324"
				width="88"
				height="19"
				className="fill-background"
				strokeWidth="1.5"
			/>
			<text
				x="236"
				y="338"
				textAnchor="middle"
				className="fill-foreground font-bold font-sans"
				fontSize="12"
				letterSpacing="2"
				stroke="none"
			>
				{t("front.platePress")}
			</text>
			{/* The pavement board. */}
			<path
				d="M60 404 l32 -98 l32 98"
				className="fill-background"
				strokeWidth="2.5"
			/>
			<rect
				x="64"
				y="328"
				width="56"
				height="54"
				fill={HALFTONE.light}
				strokeWidth="2"
			/>
			<text
				x="92"
				y="350"
				textAnchor="middle"
				className="fill-foreground font-bold font-sans"
				fontSize="11.5"
				letterSpacing="1"
				stroke="none"
			>
				{t("front.plateBoardTop")}
			</text>
			<text
				x="92"
				y="368"
				textAnchor="middle"
				className="fill-foreground font-bold font-sans"
				fontSize="11.5"
				letterSpacing="1"
				stroke="none"
			>
				{t("front.plateBoardBottom")}
			</text>
			{/* The pigeon on the sign bracket. */}
			<path
				d="M470 92 a9 7 0 1 1 -2 -12 l10 -5 -6 9 c4 2 4 6 -2 8 z"
				className="fill-foreground"
				stroke="none"
			/>
			<line x1="470" y1="92" x2="470" y2="98" strokeWidth="2" />
			<line x1="442" y1="98" x2="500" y2="98" strokeWidth="2.5" />
		</svg>
	);
}
