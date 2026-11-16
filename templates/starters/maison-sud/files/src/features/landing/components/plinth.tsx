// The caption plinth: a small raised chalk plate that straddles one corner of a photograph.
// Aperture renders it as a child. It names the room, the project, and the material.
// landing.css gives the raised shadow (ms-plinth) and the hero position (ms-plinth-seam).
// room-walk.tsx copies the plate and its three lines for its shared plinth. Change the two files together.
import { cn } from "~/shared/lib/utils";
import { MICRO_CAPS } from "../lib/type-styles";

// Corners are assigned, never random: bottom-start on a band, top-end on a portrait, the seam on the hero.
const CORNER_CLASS_NAMES = {
	// On a phone the plate hangs lower, so it hides less of a small photo.
	"bottom-start": "-bottom-10 start-[clamp(12px,3vw,30px)] md:-bottom-5",
	"top-end": "-top-5 end-[clamp(12px,3vw,30px)]",
	seam: "ms-plinth-seam",
} as const;

// A plate wider than two thirds of its photo stops being a plate. A portrait is the smallest frame, so its plate is narrower.
const WIDTH_CLASS_NAMES = {
	"bottom-start":
		"max-w-[min(88%,320px)] md:max-w-[min(66%,250px)] lg:max-w-[min(80%,340px)]",
	"top-end":
		"max-w-[min(88%,320px)] md:max-w-[min(64%,220px)] lg:max-w-[min(62%,260px)]",
	seam: "",
} as const;

type PlinthProps = {
	/** The corner of the photo that the plate crosses. "seam" is the hero plate that enters the text column. */
	corner: keyof typeof CORNER_CLASS_NAMES;
	/** Micro-cap line, for example "Room N°02 — kitchen". */
	label: string;
	/** Serif line: the name of the room or of the project. */
	title: string;
	/** Third line: surface, materials, or light. */
	note: string;
};

/** The legend of one photograph. It renders a figcaption, so its parent must be a figure. */
export function Plinth({ corner, label, title, note }: PlinthProps) {
	return (
		<figcaption
			className={cn(
				"absolute ms-plinth border border-foreground/10 bg-card px-[0.95rem] pt-[0.6rem] pb-[0.68rem]",
				CORNER_CLASS_NAMES[corner],
				WIDTH_CLASS_NAMES[corner],
			)}
		>
			<span className={cn(MICRO_CAPS, "block")}>{label}</span>
			<span className="ms-serif mt-[0.3rem] block text-[clamp(0.94rem,1.1vw,1.1rem)] leading-tight">
				{title}
			</span>
			<span className="mt-1 block text-[0.82rem] text-muted-foreground leading-normal">
				{note}
			</span>
		</figcaption>
	);
}
