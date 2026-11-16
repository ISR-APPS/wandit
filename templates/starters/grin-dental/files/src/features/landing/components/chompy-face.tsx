// The drawing of Chompy, the tooth mascot: body, shine, cheeks, blinking eyes, brows, and a mouth that can grin.
// ChompyStage renders it inside its button and owns the state. This file only draws.
// The pupils read --gd-look-x and --gd-look-y from hooks/use-pupil-follow.ts. landing.css animates the eyes.
import { type RefObject, useId } from "react";
import { cn } from "~/shared/lib/utils";

/** The closed smile and the open grin. The mouth and its clip path switch between the two; CSS animates `d`. */
const MOUTH_SMILE = "M82 138 Q120 160 158 138 Q120 172 82 138 Z";
const MOUTH_GRIN = "M72 130 Q120 196 168 130 Q120 158 72 130 Z";

/** The outline of the tooth, used for the hard shadow and for the body. */
const TOOTH_PATH =
	"M120 22 C 70 22 34 51 32 98 C 30 133 47 156 59 195 C 65 216 92 220 100 199 C 105 186 112 179 120 179 C 128 179 135 186 140 199 C 148 220 175 216 181 195 C 193 156 210 133 208 98 C 206 51 170 22 120 22 Z";

type ChompyFaceProps = {
	/** True while the pointer or the focus is on the button: the mouth opens and the tongue shows. */
	isGrinning: boolean;
	/** The SVG element. use-pupil-follow writes the look variables on it. */
	svgRef: RefObject<SVGSVGElement | null>;
	/** The body group. ChompyStage squashes it on a click. */
	bodyRef: RefObject<SVGGElement | null>;
};

/** A 240 x 250 drawing that fills the width of its parent. */
export function ChompyFace({ isGrinning, svgRef, bodyRef }: ChompyFaceProps) {
	const mouthClipId = useId();
	const mouth = isGrinning ? MOUTH_GRIN : MOUTH_SMILE;
	return (
		<svg
			ref={svgRef}
			viewBox="0 0 240 250"
			aria-hidden="true"
			focusable="false"
			className={cn("gd-chompy h-auto w-full", isGrinning && "scale-104")}
		>
			<defs>
				<clipPath id={mouthClipId}>
					<path d={mouth} className="gd-mouth" />
				</clipPath>
			</defs>
			{/* The hard sticker shadow: the same tooth in ink, 8 right and 10 down. */}
			<path
				d={TOOTH_PATH}
				transform="translate(8 10)"
				className="fill-foreground"
			/>
			<g ref={bodyRef} className="gd-squash-origin">
				<path
					d={TOOTH_PATH}
					strokeWidth="5"
					className="fill-card stroke-foreground"
				/>
				<path
					d="M62 58 Q78 40 100 38"
					fill="none"
					strokeWidth="10"
					strokeLinecap="round"
					className="stroke-(--gd-mint)"
				/>
				<circle cx="66" cy="126" r="10" className="fill-primary opacity-45" />
				<circle cx="174" cy="126" r="10" className="fill-primary opacity-45" />
				{[88, 152].map((eyeX) => (
					<g key={eyeX} className="gd-eye">
						<ellipse
							cx={eyeX}
							cy="100"
							rx="15"
							ry="17"
							strokeWidth="4"
							className="fill-card stroke-foreground"
						/>
						<g className="gd-pupils">
							<circle cx={eyeX} cy="102" r="6.4" className="fill-foreground" />
							<circle cx={eyeX + 2.5} cy="99.5" r="2.1" className="fill-card" />
						</g>
					</g>
				))}
				<path
					d="M74 76 Q88 70 100 75"
					fill="none"
					strokeWidth="4.5"
					strokeLinecap="round"
					className="stroke-foreground"
				/>
				<path
					d="M140 75 Q152 70 166 76"
					fill="none"
					strokeWidth="4.5"
					strokeLinecap="round"
					className="stroke-foreground"
				/>
				<path d={mouth} className="gd-mouth fill-foreground" />
				<circle
					cx="120"
					cy="168"
					r="22"
					clipPath={`url(#${mouthClipId})`}
					className={cn(
						"gd-tongue fill-primary",
						isGrinning ? "opacity-100" : "opacity-0",
					)}
				/>
			</g>
		</svg>
	);
}
