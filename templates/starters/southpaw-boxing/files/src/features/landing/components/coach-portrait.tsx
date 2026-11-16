// The halftone portrait of a coach: a dotted silhouette with one crimson or dark detail.
// coach-card.tsx renders it. It reads the pattern sp-dots-face of grit-defs.tsx.
import type { CoachId } from "../lib/content";

const DOTS = "url(#sp-dots-face)";

/** A decorative portrait. The drawing follows the coach: headgear, a top knot, or a flat top with a beard. */
export function CoachPortrait({ coach }: { coach: CoachId }) {
	return (
		<svg
			viewBox="0 0 120 120"
			aria-hidden="true"
			focusable="false"
			className="block size-full"
		>
			{/* The shoulders and the neck: the same for the three coaches. */}
			<path
				d="M16 120 C20 94 42 84 60 82 C78 84 100 94 104 120 Z"
				fill={DOTS}
			/>
			<rect x="50" y="62" width="20" height="22" fill={DOTS} />
			{coach === "okafor" && (
				<>
					<circle cx="61" cy="46" r="26" fill={DOTS} />
					<path
						d="M33 46 A28 28 0 0 1 89 46"
						fill="none"
						strokeWidth="8"
						className="stroke-primary opacity-85"
					/>
					<circle
						cx="74"
						cy="50"
						r="9"
						fill="none"
						strokeWidth="4"
						className="stroke-primary opacity-85"
					/>
				</>
			)}
			{coach === "vega" && (
				<>
					<circle cx="62" cy="46" r="25" fill={DOTS} />
					<circle cx="33" cy="32" r="11" fill={DOTS} />
					<path
						d="M38 40 A26 26 0 0 1 87 42"
						strokeWidth="7"
						className="sp-portrait-hair"
						fill="none"
					/>
					<rect
						x="38"
						y="33"
						width="6"
						height="12"
						transform="rotate(32 41 39)"
						className="fill-primary"
					/>
				</>
			)}
			{coach === "carter" && (
				<>
					<circle cx="61" cy="48" r="24" fill={DOTS} />
					<rect x="38" y="16" width="46" height="15" fill={DOTS} />
					<path
						d="M40 58 A24 24 0 0 0 84 60 L80 70 A29 29 0 0 1 43 67 Z"
						strokeWidth="0"
						className="sp-portrait-hair"
					/>
				</>
			)}
		</svg>
	);
}
