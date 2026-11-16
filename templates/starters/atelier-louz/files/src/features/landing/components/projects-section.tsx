// Delivered projects as a sticky split: a pinned column of drawn scenes that crossfade, beside three project texts.
// LandingPage renders it. useActiveIndex picks the scene; on a phone each project shows its scene above its text.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useActiveIndex } from "../hooks/use-active-index";
import { ArchTag } from "./arch-tag";
import { ProjectScene } from "./project-scene";
import { SectionHead } from "./section-head";

const PROJECTS = ["enfilade", "patio", "counter"] as const;

/** The projects section. Scene 1 shows before the script runs, so the layout never jumps at hydration. */
export function ProjectsSection() {
	const { t } = useT();
	const listRef = useRef<HTMLDivElement>(null);
	const activeIndex = useActiveIndex(listRef);
	return (
		<section
			id="projects"
			aria-labelledby="projects-title"
			className="louz-section"
		>
			<div className="mx-auto max-w-[1340px] px-5 sm:px-8">
				<SectionHead
					tag={t("projects.tag")}
					title={t("projects.title")}
					titleId="projects-title"
					intro={t("projects.intro")}
					className="mb-6 lg:mb-12"
				/>
				<div className="grid lg:grid-cols-[48fr_52fr] lg:gap-20">
					{/* The pinned column. Its scenes repeat the ones in the articles, so screen readers skip it. */}
					<div
						aria-hidden="true"
						className="louz-scene-stack sticky top-[9vh] hidden h-[82vh] self-start lg:grid"
					>
						{PROJECTS.map((project, index) => (
							<div
								key={project}
								className={cn(
									"col-start-1 row-start-1 flex items-center",
									index === activeIndex ? "opacity-100" : "opacity-0",
								)}
							>
								<ProjectScene
									scene={project}
									label={t(`projects.${project}.sceneLabel`)}
								/>
							</div>
						))}
					</div>
					<div ref={listRef}>
						{PROJECTS.map((project, index) => (
							<article
								key={project}
								data-index={index}
								className="flex flex-col justify-center border-(--louz-hair) py-12 lg:min-h-[58vh] lg:py-8 [&+&]:border-t"
							>
								<div className="mb-6 max-w-[360px] lg:hidden">
									<ProjectScene
										scene={project}
										label={t(`projects.${project}.sceneLabel`)}
									/>
								</div>
								<div data-reveal>
									<ArchTag>{t(`projects.${project}.place`)}</ArchTag>
									<h3 className="mt-4 mb-3 font-display font-normal text-[clamp(1.7rem,3vw,2.5rem)] leading-[1.1]">
										{t(`projects.${project}.title`)}
									</h3>
									<p className="mb-6 max-w-[46ch] leading-relaxed">
										{t(`projects.${project}.body`)}
									</p>
									<dl className="flex flex-wrap gap-2.5 font-bold text-[0.8rem] leading-none">
										<div className="louz-chip flex gap-1.5">
											<dt className="sr-only">{t("projects.area")}</dt>
											<dd>{t(`projects.${project}.area`)}</dd>
										</div>
										<div className="louz-chip flex gap-1.5">
											<dt className="sr-only">{t("projects.duration")}</dt>
											<dd>{t(`projects.${project}.duration`)}</dd>
										</div>
										<div className="louz-chip louz-chip-fill">
											<dt className="sr-only">
												{t("projects.materialsLabel")}
											</dt>
											<dd>{t(`projects.${project}.materials`)}</dd>
										</div>
									</dl>
								</div>
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
