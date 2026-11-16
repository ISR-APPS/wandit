// Section 05, the wall: the six covers as a mosaic of plates at three sizes, each with a mono caption.
// LandingPage renders it. Each index row of the hero jumps to its cover here (id "cover-<project>").
import { useT } from "~/shared/i18n";
import { CASE_PROJECT, PROJECTS, type ProjectId } from "../lib/projects";
import {
	BAND,
	MONO,
	RULED_LINK,
	RULED_LINK_TEXT,
	SECTION_TITLE,
	WRAP,
} from "../lib/type-styles";
import { AccentDot } from "./accent-dot";
import { Plate } from "./plate";
import { SectionHead } from "./section-head";

// The aspect ratio of each plate: 3/2 on a phone, 4/3 on two columns, and its own ratio in the mosaic from 1024px.
// In the mosaic the heights of the first row go down, and the heights of the second row go up.
const TWO_COLUMN_ASPECT = "aspect-[3/2] min-[601px]:aspect-[4/3]";
const ASPECT_OF: Record<ProjectId, string> = {
	mellah: TWO_COLUMN_ASPECT,
	sirocco: `${TWO_COLUMN_ASPECT} lg:aspect-square`,
	warqa: `${TWO_COLUMN_ASPECT} lg:aspect-[3/2]`,
	casbah: `${TWO_COLUMN_ASPECT} lg:aspect-[3/2]`,
	nedjma: `${TWO_COLUMN_ASPECT} lg:aspect-square`,
	sahar: `${TWO_COLUMN_ASPECT} lg:aspect-[3/2]`,
};

/** The mosaic. The row of the case study project jumps to the section "case", so its cover has no anchor id. */
export function WallSection() {
	const { t } = useT();
	return (
		<section
			id="wall"
			aria-labelledby="wall-title"
			data-cascade=""
			className={BAND}
		>
			<div className={WRAP}>
				<SectionHead label={t("wall.label")}>
					<h2 id="wall-title" className={`${SECTION_TITLE} sable-fade`}>
						{t("wall.title")}
						<AccentDot />
					</h2>
				</SectionHead>
				<div className="sable-wall">
					{PROJECTS.map((project) => (
						<figure
							key={project.id}
							id={project.id === CASE_PROJECT.id ? undefined : project.targetId}
							className="sable-wall-item sable-fade"
						>
							<Plate
								project={project}
								aspectClassName={ASPECT_OF[project.id]}
							/>
							<figcaption
								className={`${MONO} mt-2.5 flex flex-wrap justify-between gap-x-3 gap-y-1 border-foreground/14 border-t pt-2 text-[11.5px] text-foreground/55`}
							>
								<span className="whitespace-nowrap text-foreground">
									{t(`projects.${project.id}.name`)}
								</span>
								<span>{t(`projects.${project.id}.wallCaption`)}</span>
							</figcaption>
						</figure>
					))}
				</div>
				<p
					className={`${MONO} sable-fade mt-[clamp(20px,3vh,34px)] flex flex-wrap items-center justify-between gap-x-8 border-foreground border-t pt-1 text-foreground/55`}
				>
					<span>{t("wall.footNote")}</span>
					<a href="#contact" className={RULED_LINK}>
						<span className={RULED_LINK_TEXT}>
							{t("wall.footLink")}{" "}
							<span
								aria-hidden="true"
								className="inline-block rtl:-scale-x-100"
							>
								→
							</span>
						</span>
					</a>
				</p>
			</div>
		</section>
	);
}
