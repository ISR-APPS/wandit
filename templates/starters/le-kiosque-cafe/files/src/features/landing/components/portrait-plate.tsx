// A halftone portrait of the newsroom: a bust on a dense-dot block, like a press photo.
// NewsroomSection renders one per journalist. `face` picks the hair and the details of lib/content.ts.
import type { PortraitFace } from "../lib/content";
import { HALFTONE } from "./halftone-defs";

/** One portrait. The label names the person for screen readers. */
export function PortraitPlate({
	face,
	label,
}: {
	face: PortraitFace;
	/** The aria-label of the plate, already translated. */
	label: string;
}) {
	return (
		<svg
			viewBox="0 0 260 300"
			role="img"
			aria-label={label}
			className="block h-auto w-full text-foreground"
			fill="none"
			stroke="currentColor"
		>
			<rect
				x="8"
				y="8"
				width="244"
				height="284"
				fill={HALFTONE.dense}
				strokeWidth="2"
			/>
			<path
				d="M46 292 c0 -58 36 -84 84 -84 s84 26 84 84 z"
				fill={HALFTONE.mid}
				strokeWidth="2.5"
			/>
			{face === "bun" && <BunFace />}
			{face === "cap" && <CapFace />}
			{face === "glasses" && <GlassesFace />}
		</svg>
	);
}

/** Nadia Berrah: a bun on top, small earrings. */
function BunFace() {
	return (
		<>
			<ellipse
				cx="130"
				cy="146"
				rx="46"
				ry="54"
				className="fill-background"
				strokeWidth="2.5"
			/>
			<circle
				cx="130"
				cy="78"
				r="26"
				className="fill-foreground"
				stroke="none"
			/>
			<path
				d="M84 132 c4 -34 24 -46 46 -46 s42 12 46 46 l-10 4 c-2 -24 -16 -34 -36 -34 s-34 10 -36 34 z"
				className="fill-foreground"
				stroke="none"
			/>
			<circle
				cx="114"
				cy="150"
				r="3.2"
				className="fill-foreground"
				stroke="none"
			/>
			<circle
				cx="146"
				cy="150"
				r="3.2"
				className="fill-foreground"
				stroke="none"
			/>
			<path d="M120 174 c6 5 14 5 20 0" strokeWidth="2.5" />
			<circle
				cx="86"
				cy="164"
				r="4"
				className="fill-foreground"
				stroke="none"
			/>
			<circle
				cx="174"
				cy="164"
				r="4"
				className="fill-foreground"
				stroke="none"
			/>
		</>
	);
}

/** Émile Roche: a flat cap and a beard. */
function CapFace() {
	return (
		<>
			<ellipse
				cx="130"
				cy="150"
				rx="46"
				ry="54"
				className="fill-background"
				strokeWidth="2.5"
			/>
			<path
				d="M82 122 c10 -26 82 -28 96 -2 l4 12 h-104 z"
				className="fill-foreground"
				stroke="none"
			/>
			<path d="M76 134 h62" strokeWidth="6" strokeLinecap="round" />
			<path
				d="M98 180 c2 26 62 26 64 0 c0 30 -12 44 -32 44 s-32 -14 -32 -44 z"
				fill={HALFTONE.mid}
				strokeWidth="2"
			/>
			<circle
				cx="114"
				cy="156"
				r="3.2"
				className="fill-foreground"
				stroke="none"
			/>
			<circle
				cx="146"
				cy="156"
				r="3.2"
				className="fill-foreground"
				stroke="none"
			/>
		</>
	);
}

/** Sofia Marino: a short bob and round glasses. */
function GlassesFace() {
	return (
		<>
			<path
				d="M84 108 c0 -26 92 -26 92 0 v66 c0 10 -10 14 -14 8 v-52 c-20 12 -44 12 -64 0 v52 c-4 6 -14 2 -14 -8 z"
				className="fill-foreground"
				stroke="none"
			/>
			<ellipse
				cx="130"
				cy="150"
				rx="44"
				ry="52"
				className="fill-background"
				strokeWidth="2.5"
			/>
			<circle cx="112" cy="152" r="13" strokeWidth="2.5" />
			<circle cx="148" cy="152" r="13" strokeWidth="2.5" />
			<line x1="125" y1="152" x2="135" y2="152" strokeWidth="2.5" />
			<path d="M122 182 c5 4 11 4 16 0" strokeWidth="2.5" />
		</>
	);
}
