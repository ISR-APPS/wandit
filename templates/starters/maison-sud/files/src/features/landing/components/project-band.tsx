// A project shown with one 2/1 photo band across the twelve columns, then text and facts under it.
// ProjectsSection renders it for project 02. The plinth sits on the bottom-start corner of the band.
import { cn } from "~/shared/lib/utils";
import { GRID, PROSE } from "../lib/type-styles";
import { Aperture } from "./aperture";
import { type GlyphFact, GlyphList } from "./glyph-list";
import { Plinth } from "./plinth";
import { ProjectTitle } from "./project-title";

type ProjectBandProps = {
	/** Two digits of the project number. */
	digits: string;
	name: string;
	/** One translated paragraph. */
	body: string;
	facts: readonly GlyphFact[];
	/** The photo: public path, pixel size, alt text, and the object-position class of the wide crop. */
	image: {
		src: string;
		width: number;
		height: number;
		alt: string;
		focusClassName: string;
	};
	/** The three lines of the plinth. */
	plinth: { label: string; title: string; note: string };
};

/** One project article with a full-width band. The facts end on the same line as the text. */
export function ProjectBand({
	digits,
	name,
	body,
	facts,
	image,
	plinth,
}: ProjectBandProps) {
	return (
		<article className={cn(GRID, "gap-y-0")}>
			<Aperture
				src={image.src}
				alt={image.alt}
				width={image.width}
				height={image.height}
				shape="band"
				focusClassName={image.focusClassName}
				className="mb-14 md:col-span-12 md:mb-8.5"
			>
				<Plinth
					corner="bottom-start"
					label={plinth.label}
					title={plinth.title}
					note={plinth.note}
				/>
			</Aperture>
			<div data-reveal="lift" className="md:col-span-6 md:mt-10">
				<ProjectTitle digits={digits} name={name} />
				<p className={cn(PROSE, "mt-4")}>{body}</p>
			</div>
			<GlyphList
				facts={facts}
				className="mt-5 self-end md:col-span-5 md:col-start-8 md:mt-10"
			/>
		</article>
	);
}
