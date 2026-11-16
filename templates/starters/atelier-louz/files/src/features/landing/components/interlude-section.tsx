// The one deep interlude of the page: palm green, ivory ink, and an arch sun that rises as the visitor scrolls.
// LandingPage renders it between the projects and the method. useScrollProgress drives the sun.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollProgress } from "../hooks/use-scroll-progress";
import { ArchTag } from "./arch-tag";

/** The studio conviction in one line, over the rising sun. With no script the sun rests at its composed height. */
export function InterludeSection() {
	const { t } = useT();
	const sectionRef = useRef<HTMLElement>(null);
	useScrollProgress(sectionRef);
	return (
		<section
			ref={sectionRef}
			aria-label={t("interlude.tag")}
			className="louz-interlude relative flex min-h-[92vh] items-center justify-center overflow-hidden px-6 py-[clamp(5rem,12vh,8rem)] text-center"
		>
			<div
				aria-hidden="true"
				className="louz-sun absolute start-1/2 bottom-0 z-0 w-[min(84vw,660px)]"
			/>
			<div className="relative z-10 flex flex-col items-center">
				<ArchTag tone="light" className="mb-8">
					{t("interlude.tag")}
				</ArchTag>
				<p className="max-w-[16ch] font-display text-[clamp(2.5rem,6.6vw,5.6rem)] leading-[1.08]">
					{t("interlude.lineStart")}{" "}
					<span className="block">{t("interlude.lineEnd")}</span>
				</p>
			</div>
		</section>
	);
}
