// Section 05, the evening: the one ash panel of the page, with three moments that step down.
// LandingPage renders it. It reads EVENING_MOMENTS of lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { EVENING_MOMENTS } from "../lib/content";
import { FIGURE, SECTION_TITLE } from "../lib/type-styles";
import { Eyebrow } from "./eyebrow";

/** The staggered evening. The world spends its single ash ground here. */
export function EveningSection() {
	const { t } = useT();
	return (
		<section
			id="evening"
			aria-labelledby="evening-title"
			className="br-section bg-(--br-ash)"
		>
			<div className="br-wrap">
				<Eyebrow className="mb-[clamp(14px,1.6vw,22px)]">
					{t("evening.eyebrow")}
				</Eyebrow>
				{/* The head uses the columns and gap of .br-moments, so the note lines up with the third moment. */}
				<div
					className="mb-[clamp(36px,6vh,68px)] grid items-start gap-[clamp(22px,4vh,32px)] min-[860px]:grid-cols-3 min-[860px]:items-end min-[860px]:gap-[clamp(20px,3.4vw,54px)]"
					data-reveal="rise"
				>
					<h2
						id="evening-title"
						className={cn(SECTION_TITLE, "max-w-[15ch] min-[860px]:col-span-2")}
					>
						{t("evening.title")}
					</h2>
					<p className="max-w-[36ch] text-pretty border-(--br-hair) border-t pt-[18px] text-[clamp(12.5px,0.92vw,14px)] text-foreground/62 leading-[1.55] tracking-[0.03em] min-[860px]:max-w-none">
						{t("evening.note")}
					</p>
				</div>
				<ol className="br-moments">
					{EVENING_MOMENTS.map((moment) => (
						<li
							key={moment.id}
							className="br-moment border-(--br-hair) border-t pt-[22px] pb-[26px] min-[860px]:pb-0"
							data-reveal="rise"
						>
							<p
								className={cn(
									FIGURE,
									"font-bold text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[0.94] tracking-[-0.045em]",
								)}
							>
								{t(moment.timeKey)}
							</p>
							<span
								aria-hidden="true"
								className="br-uline br-uline--short mt-3.5"
							/>
							<h3 className="mt-4 mb-2.5 font-display font-semibold text-[clamp(1.02rem,1.35vw,1.28rem)] tracking-[-0.015em]">
								{t(moment.titleKey)}
							</h3>
							<p className="max-w-[42ch] text-[clamp(13px,0.95vw,14.8px)] text-foreground/62 leading-[1.55] min-[860px]:max-w-[30ch]">
								{t(moment.bodyKey)}
							</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
