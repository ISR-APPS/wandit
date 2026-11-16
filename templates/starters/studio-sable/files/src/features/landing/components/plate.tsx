// A typographic cover: a flat two-color rectangle with the name of the project as its own logotype.
// The wall, the case study, and the cover preview render it. It is the only imagery of the page.
// landing.css draws the four recipes. Each size is a share of the plate width, so one plate works at any size.
import { useT } from "~/shared/i18n";
import type { Project } from "../lib/projects";

type PlateProps = {
	project: Project;
	/** The aspect ratio class of the plate, for example "aspect-[3/2]". The CSS gives the width. */
	aspectClassName: string;
	/** True in the cover preview: the row beside it already names the project, so the plate has no label. */
	isDecorative?: boolean;
};

// The stack recipe prints the name four times. The index is the key of each line.
const STACK_LINES = [0, 1, 2, 3];

/** One cover. A screen reader gets the description of the plate from the message group of the project. */
export function Plate({
	project,
	aspectClassName,
	isDecorative = false,
}: PlateProps) {
	const { t } = useT();
	const name = t(`projects.${project.id}.name`);
	const { recipe, tone } = project.plate;
	const art = (
		<>
			{/* translate() takes no parameters, so the word order of this line is fixed here on purpose. */}
			<span className="sable-plate-code sable-mono uppercase">
				{t("projects.reference")} {project.number} · {project.year}
			</span>
			{recipe === "name" && (
				<>
					<span aria-hidden="true" className="sable-plate-rule" />
					<span className="sable-plate-name">{name}</span>
				</>
			)}
			{recipe === "letter" && (
				<span aria-hidden="true" className="sable-plate-letter">
					{name.charAt(0)}
				</span>
			)}
			{recipe === "stack" && (
				<span aria-hidden="true" className="sable-plate-stack">
					{STACK_LINES.map((line) => (
						<span key={line}>{name}</span>
					))}
				</span>
			)}
			{recipe === "point" && (
				<span aria-hidden="true" className="sable-plate-lockup">
					<span className="sable-plate-line">
						<span className="sable-plate-small">{name}</span>
						<span className="sable-plate-dot" />
					</span>
				</span>
			)}
		</>
	);
	const className = `sable-plate font-display ${aspectClassName}`;
	// Two branches on purpose: Biome (useAriaPropsSupportedByRole) refuses an aria-label next to a conditional role.
	if (isDecorative) {
		return (
			<div className={className} data-recipe={recipe} data-tone={tone}>
				{art}
			</div>
		);
	}
	return (
		<div
			className={className}
			data-recipe={recipe}
			data-tone={tone}
			role="img"
			aria-label={t(`projects.${project.id}.plateLabel`)}
		>
			{art}
		</div>
	);
}
