// A project shown with a 3/4 portrait photo and its text beside it.
// ProjectsSection renders it twice: photo first for project 01, mirrored for project 03.
// The plinth sits on the top-end corner of the photo.
import { cn } from "~/shared/lib/utils";
import { GRID, PROSE } from "../lib/type-styles";
import { Aperture } from "./aperture";
import { type GlyphFact, GlyphList } from "./glyph-list";
import { Plinth } from "./plinth";
import { ProjectTitle } from "./project-title";

type ProjectPortraitProps = {
	/** Two digits of the project number. */
	digits: string;
	name: string;
	/** One or two paragraphs. Each one is a translated text. */
	paragraphs: readonly string[];
	facts: readonly GlyphFact[];
	/** The photo: public path, pixel size, and alt text. */
	image: { src: string; width: number; height: number; alt: string };
	/** The three lines of the plinth. */
	plinth: { label: string; title: string; note: string };
	/** True puts the text first and the photo at the end, as for project 03. */
	isMirrored?: boolean;
};

/** One project article. From 768px the photo and the text sit on one row, with one empty column between them. */
export function ProjectPortrait({
	digits,
	name,
	paragraphs,
	facts,
	image,
	plinth,
	isMirrored = false,
}: ProjectPortraitProps) {
	// The first portrait drops by up to 4rem, so the two columns do not start on one line.
	const figurePlacement = isMirrored
		? "md:order-2 md:col-span-6 md:col-start-7 lg:col-span-5 lg:col-start-7"
		: "md:col-span-5 md:mt-[calc(1.625rem+clamp(0px,4vw,4rem))]";
	return (
		<article className={cn(GRID, "gap-y-9")}>
			<Aperture
				src={image.src}
				alt={image.alt}
				width={image.width}
				height={image.height}
				shape="portrait"
				className={cn("mt-6.5", figurePlacement)}
			>
				<Plinth
					corner="top-end"
					label={plinth.label}
					title={plinth.title}
					note={plinth.note}
				/>
			</Aperture>
			<div
				className={cn(
					"self-center",
					isMirrored
						? "md:order-1 md:col-span-5"
						: "md:col-span-6 md:col-start-7",
				)}
			>
				<div data-reveal="lift">
					<ProjectTitle digits={digits} name={name} />
					{paragraphs.map((paragraph) => (
						<p key={paragraph} className={cn(PROSE, "mt-4")}>
							{paragraph}
						</p>
					))}
				</div>
				<GlyphList facts={facts} className="mt-5" />
			</div>
		</article>
	);
}
