// The plate of the showpiece: Nadia Berrah at the drum, a halftone portrait that develops like a print in the bath.
// PressSection renders it in the mini front page. It keeps its own dot bank: kiosque.css scales those dots
// with the press progress. With no script or with reduced motion, the dots stay at full size.
import { useT } from "~/shared/i18n";

// The developing densities. The class names match the develop rules of kiosque.css.
const DEVELOP_BANK = [
	{ id: "ks-dev-l", radius: 0.9, dotClass: "ks-dev ks-dev-l" },
	{ id: "ks-dev-m", radius: 1.5, dotClass: "ks-dev ks-dev-m" },
	{ id: "ks-dev-d", radius: 2.05, dotClass: "ks-dev ks-dev-d" },
] as const;

/** The portrait: hair in a bun, small earrings, apron, shade on one side of the face. */
export function RoasterPlate() {
	const { t } = useT();
	return (
		<svg
			viewBox="0 0 300 340"
			role="img"
			aria-label={t("press.plateLabel")}
			className="block h-auto w-full text-foreground"
			fill="none"
			stroke="currentColor"
		>
			<defs>
				{DEVELOP_BANK.map((density) => (
					<pattern
						key={density.id}
						id={density.id}
						width="6"
						height="6"
						patternUnits="userSpaceOnUse"
						patternTransform="rotate(15)"
					>
						<rect width="6" height="6" className="fill-background" />
						<circle
							cx="3"
							cy="3"
							r={density.radius}
							className={`${density.dotClass} fill-foreground`}
						/>
					</pattern>
				))}
			</defs>
			<rect
				x="10"
				y="10"
				width="280"
				height="320"
				fill="url(#ks-dev-d)"
				strokeWidth="2"
			/>
			{/* Shoulders and apron. */}
			<path
				d="M58 330 c0 -64 42 -94 92 -94 s92 30 92 94 z"
				fill="url(#ks-dev-m)"
				strokeWidth="2.5"
			/>
			<path
				d="M104 330 c0 -48 18 -70 46 -70 s46 22 46 70 z"
				className="fill-background"
				strokeWidth="2"
			/>
			<line x1="122" y1="268" x2="112" y2="330" strokeWidth="1.5" />
			<line x1="178" y1="268" x2="188" y2="330" strokeWidth="1.5" />
			{/* Neck and collar. */}
			<path
				d="M132 240 h36 l8 22 h-52 z"
				className="fill-background"
				strokeWidth="2"
			/>
			{/* Ears. */}
			<path
				d="M96 186 a10 12 0 1 0 8 22"
				className="fill-background"
				strokeWidth="2"
			/>
			<path
				d="M204 186 a10 12 0 1 1 -8 22"
				className="fill-background"
				strokeWidth="2"
			/>
			<ellipse
				cx="150"
				cy="184"
				rx="50"
				ry="58"
				className="fill-background"
				strokeWidth="2.5"
			/>
			{/* The shade side of the face. */}
			<path
				d="M178 136 c16 12 24 30 22 52 c-2 26 -12 42 -26 50 c10 -18 14 -38 12 -60 c-2 -18 -6 -32 -8 -42 z"
				fill="url(#ks-dev-l)"
				stroke="none"
			/>
			{/* The bun, then the hair line: the same face as her newsroom portrait (BunFace). */}
			<circle
				cx="150"
				cy="110"
				r="28"
				className="fill-foreground"
				stroke="none"
			/>
			<path
				d="M100 169 c4 -37 26 -50 50 -50 s46 13 50 50 l-11 4 c-2 -26 -17 -37 -39 -37 s-37 11 -39 37 z"
				className="fill-foreground"
				stroke="none"
			/>
			{/* Small earrings under the ears. */}
			<circle
				cx="100"
				cy="213"
				r="4"
				className="fill-foreground"
				stroke="none"
			/>
			<circle
				cx="200"
				cy="213"
				r="4"
				className="fill-foreground"
				stroke="none"
			/>
			<path d="M102 166 c-2 12 -2 22 1 32" strokeWidth="2" />
			<path d="M198 166 c2 12 2 22 -1 32" strokeWidth="2" />
			<path d="M122 176 c6 -4 14 -4 20 0" strokeWidth="2.5" />
			<path d="M158 176 c6 -4 14 -4 20 0" strokeWidth="2.5" />
			<circle
				cx="132"
				cy="188"
				r="3.4"
				className="fill-foreground"
				stroke="none"
			/>
			<circle
				cx="168"
				cy="188"
				r="3.4"
				className="fill-foreground"
				stroke="none"
			/>
			<path d="M150 190 c2 8 2 14 -4 18" strokeWidth="2" />
			<path d="M138 220 c8 6 16 6 24 0" strokeWidth="2.5" />
		</svg>
	);
}
