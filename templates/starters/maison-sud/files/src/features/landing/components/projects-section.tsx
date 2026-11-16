// The projects section: three delivered interiors on the second ground of the page.
// The layout is asymmetric on purpose: a portrait, a full band, then a mirrored portrait.
// LandingPage renders it. It reads the texts of the "projects" message group.
import { useT } from "~/shared/i18n";
import { WRAP } from "../lib/type-styles";
import { ProjectBand } from "./project-band";
import { ProjectPortrait } from "./project-portrait";
import { SectionHead } from "./section-head";

/** Section "Projects". Never two project layouts alike side by side. */
export function ProjectsSection() {
	const { t } = useT();
	return (
		<section
			id="projects"
			className="scroll-mt-28 bg-canvas py-(--ms-rhythm) md:scroll-mt-19"
		>
			<div className={WRAP}>
				<SectionHead
					label={t("projects.label")}
					titleLines={[t("projects.title1"), t("projects.title2")]}
					note={t("projects.note")}
				/>
				<div className="grid gap-y-[clamp(3.2rem,6vw,5.4rem)]">
					<ProjectPortrait
						digits="01"
						name={t("projects.house7Name")}
						paragraphs={[t("projects.house7Body")]}
						facts={[
							{ glyph: "room", text: t("projects.house7Fact1") },
							{ glyph: "plan", text: t("projects.house7Fact2") },
							{ glyph: "stair", text: t("projects.house7Fact3") },
						]}
						image={{
							src: "/images/kitchen.webp",
							width: 1440,
							height: 1920,
							alt: t("projects.house7Alt"),
						}}
						plinth={{
							label: t("projects.house7PlinthLabel"),
							title: t("projects.house7PlinthTitle"),
							note: t("projects.house7PlinthNote"),
						}}
					/>
					<ProjectBand
						digits="02"
						name={t("projects.duplexName")}
						body={t("projects.duplexBody")}
						facts={[
							{ glyph: "room", text: t("projects.duplexFact1") },
							{ glyph: "window", text: t("projects.duplexFact2") },
							{ glyph: "plan", text: t("projects.duplexFact3") },
						]}
						image={{
							src: "/images/bedroom.webp",
							width: 1600,
							height: 900,
							alt: t("projects.duplexAlt"),
							focusClassName: "object-[center_62%]",
						}}
						plinth={{
							label: t("projects.duplexPlinthLabel"),
							title: t("projects.duplexPlinthTitle"),
							note: t("projects.duplexPlinthNote"),
						}}
					/>
					<ProjectPortrait
						isMirrored
						digits="03"
						name={t("projects.rovigoName")}
						paragraphs={[t("projects.rovigoBody1"), t("projects.rovigoBody2")]}
						facts={[
							{ glyph: "corridor", text: t("projects.rovigoFact1") },
							{ glyph: "plan", text: t("projects.rovigoFact2") },
						]}
						image={{
							src: "/images/corridor.webp",
							width: 1440,
							height: 1920,
							alt: t("projects.rovigoAlt"),
						}}
						plinth={{
							label: t("projects.rovigoPlinthLabel"),
							title: t("projects.rovigoPlinthTitle"),
							note: t("projects.rovigoPlinthNote"),
						}}
					/>
				</div>
			</div>
		</section>
	);
}
