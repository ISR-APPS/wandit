// The drawn portraits of the team, each in its own frame: a blob, a dotted arch, a second blob, and a squircle.
// TeamMemberCard renders one. Flat fills and 4px ink lines; the skin tones are the --gd-skin-* mixes of landing.css.
// Each frame draws an ink copy of itself 7 right and 8 down as the hard sticker shadow.
import { useId } from "react";
import type { PortraitKind } from "../lib/content";

/** The frame outline of each portrait, in the 200 x 200 space. */
const FRAMES: Record<PortraitKind, string> = {
	maya: "M100,8 C150,4 190,40 192,92 C194,146 158,192 102,194 C48,196 10,152 8,98 C6,46 50,12 100,8 Z",
	jonas: "M24,194 L24,100 A76,76 0 0 1 176,100 L176,194 Z",
	rui: "M98,6 C152,10 194,48 192,102 C190,154 150,194 98,192 C44,190 8,150 8,98 C8,44 44,2 98,6 Z",
	bea: "M72,10 H128 A62,62 0 0 1 190,72 V128 A62,62 0 0 1 128,190 H72 A62,62 0 0 1 10,128 V72 A62,62 0 0 1 72,10 Z",
};

/** A square drawing with `role="img"`. `label` is its spoken description. */
export function MemberPortrait({
	kind,
	label,
}: {
	kind: PortraitKind;
	label: string;
}) {
	const clipId = useId();
	const dotsId = useId();
	const frame = FRAMES[kind];
	return (
		<svg
			viewBox="0 0 200 200"
			role="img"
			aria-label={label}
			className="h-auto w-full overflow-visible"
		>
			<defs>
				<clipPath id={clipId}>
					<path d={frame} />
				</clipPath>
				<pattern
					id={dotsId}
					width="26"
					height="26"
					patternUnits="userSpaceOnUse"
				>
					<circle
						cx="7"
						cy="7"
						r="2.6"
						className="fill-(--gd-teal) opacity-22"
					/>
				</pattern>
			</defs>
			<path d={frame} transform="translate(7 8)" className="fill-foreground" />
			<g
				clipPath={`url(#${clipId})`}
				strokeWidth="4"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				{kind === "maya" && (
					<>
						<rect width="200" height="200" className="fill-(--gd-peach)" />
						<path
							d="M38,200 C38,148 68,128 100,128 C132,128 162,148 162,200 Z"
							className="fill-(--gd-teal) stroke-foreground"
						/>
						<path
							d="M84,138 l8,10 8,-10"
							fill="none"
							className="stroke-background"
						/>
						<circle
							cx="100"
							cy="86"
							r="42"
							className="fill-(--gd-skin-deep) stroke-foreground"
						/>
						<path
							d="M58,86 C56,44 144,44 142,86 C136,58 64,58 58,86 Z"
							className="fill-foreground"
						/>
						<circle cx="54" cy="70" r="13" className="fill-foreground" />
						<circle cx="146" cy="70" r="13" className="fill-foreground" />
						<path
							d="M84,86 q5,-6 10,0 M106,86 q5,-6 10,0"
							fill="none"
							className="stroke-foreground"
						/>
						<path
							d="M86,102 q14,12 28,0"
							fill="none"
							className="stroke-foreground"
						/>
						<circle cx="72" cy="98" r="6" className="fill-primary opacity-50" />
						<circle
							cx="128"
							cy="98"
							r="6"
							className="fill-primary opacity-50"
						/>
					</>
				)}
				{kind === "jonas" && (
					<>
						<rect width="200" height="200" className="fill-(--gd-mint)" />
						<rect width="200" height="200" fill={`url(#${dotsId})`} />
						<path
							d="M26,200 C26,144 64,122 100,122 C136,122 174,144 174,200 Z"
							className="fill-primary stroke-foreground"
						/>
						<circle
							cx="56"
							cy="98"
							r="8"
							className="fill-(--gd-skin-light) stroke-foreground"
						/>
						<circle
							cx="144"
							cy="98"
							r="8"
							className="fill-(--gd-skin-light) stroke-foreground"
						/>
						<circle
							cx="100"
							cy="92"
							r="47"
							className="fill-(--gd-skin-light) stroke-foreground"
						/>
						<path
							d="M52,96 C50,42 150,42 148,96 C144,70 134,60 100,60 C66,60 56,70 52,96 Z"
							className="fill-foreground"
						/>
						<circle
							cx="82"
							cy="92"
							r="13"
							fill="none"
							className="stroke-foreground"
						/>
						<circle
							cx="118"
							cy="92"
							r="13"
							fill="none"
							className="stroke-foreground"
						/>
						<path d="M95,92 h10" className="stroke-foreground" />
						<circle cx="82" cy="92" r="3.2" className="fill-foreground" />
						<circle cx="118" cy="92" r="3.2" className="fill-foreground" />
						<path
							d="M86,112 q14,11 28,0"
							fill="none"
							className="stroke-foreground"
						/>
						<circle
							cx="70"
							cy="104"
							r="6"
							className="fill-primary opacity-50"
						/>
						<circle
							cx="130"
							cy="104"
							r="6"
							className="fill-primary opacity-50"
						/>
					</>
				)}
				{kind === "rui" && (
					<>
						<rect width="200" height="200" className="fill-background" />
						<path
							d="M38,200 C38,150 68,130 100,130 C132,130 162,150 162,200 Z"
							className="fill-(--gd-teal) stroke-foreground"
						/>
						<circle
							cx="100"
							cy="88"
							r="42"
							className="fill-(--gd-skin-tan) stroke-foreground"
						/>
						<path
							d="M56,84 C56,54 74,42 100,42 C126,42 144,54 144,84 L138,74 C128,60 72,60 62,74 Z"
							className="fill-(--gd-sun) stroke-foreground"
						/>
						<path
							d="M84,88 q5,-7 10,1 M106,89 q5,-8 10,0"
							fill="none"
							className="stroke-foreground"
						/>
						<path
							d="M84,104 q16,14 32,0"
							fill="none"
							className="stroke-foreground"
						/>
						<circle
							cx="72"
							cy="100"
							r="6"
							className="fill-primary opacity-50"
						/>
						<circle
							cx="128"
							cy="100"
							r="6"
							className="fill-primary opacity-50"
						/>
					</>
				)}
				{kind === "bea" && (
					<>
						<rect width="200" height="200" className="fill-(--gd-peach)" />
						<path
							d="M38,200 C38,150 68,132 100,132 C132,132 162,150 162,200 Z"
							className="fill-(--gd-sun) stroke-foreground"
						/>
						<path
							d="M52,150 C40,110 44,60 100,52 C156,60 160,110 148,150 L136,146 C146,110 140,72 100,68 C60,72 54,110 64,146 Z"
							className="fill-primary stroke-foreground"
						/>
						<circle
							cx="100"
							cy="92"
							r="38"
							className="fill-(--gd-skin-fair) stroke-foreground"
						/>
						<path
							d="M62,92 C60,62 140,62 138,92 C130,72 70,72 62,92 Z"
							className="fill-primary"
						/>
						<circle cx="87" cy="94" r="3.4" className="fill-foreground" />
						<circle cx="113" cy="94" r="3.4" className="fill-foreground" />
						<path
							d="M88,108 q12,10 24,0"
							fill="none"
							className="stroke-foreground"
						/>
						<circle
							cx="76"
							cy="104"
							r="5.5"
							className="fill-primary opacity-50"
						/>
						<circle
							cx="124"
							cy="104"
							r="5.5"
							className="fill-primary opacity-50"
						/>
					</>
				)}
			</g>
			<path
				d={frame}
				fill="none"
				strokeWidth="5"
				className="stroke-foreground"
			/>
		</svg>
	);
}
