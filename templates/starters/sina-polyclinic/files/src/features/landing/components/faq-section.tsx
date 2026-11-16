// The frequent questions on a quiet band: six native details elements in two columns.
// LandingPage renders it. The questions come from QUESTION_COLUMNS of lib/content.ts. landing.css draws the plus mark.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { QUESTION_COLUMNS } from "../lib/content";
import { SECTION_TITLE, WRAP } from "../lib/type-styles";
import { SectionLabel } from "./section-label";

/** The section with the id "questions". A details element opens with no script. */
export function FaqSection() {
	const { t } = useT();
	return (
		<section
			id="questions"
			aria-labelledby="questions-title"
			className="sp-quiet scroll-mt-16 py-[clamp(3.4rem,6vw,5.5rem)]"
		>
			<div className={WRAP}>
				<SectionLabel tone="quiet">{t("faq.label")}</SectionLabel>
				<div className="mb-[clamp(30px,4vw,52px)] grid gap-4.5 min-[56.25rem]:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] min-[56.25rem]:items-end min-[56.25rem]:gap-[clamp(20px,4vw,64px)]">
					<h2
						id="questions-title"
						className={cn(
							SECTION_TITLE,
							"max-w-[22ch] min-[56.25rem]:max-w-[17ch]",
						)}
					>
						{t("faq.title")}
					</h2>
					<p className="max-w-[46ch] text-balance text-[0.9375rem] text-muted-foreground leading-[1.7]">
						{t("faq.note")}
					</p>
				</div>
				<div className="grid gap-x-[clamp(24px,4vw,64px)] min-[56.25rem]:grid-cols-2">
					{QUESTION_COLUMNS.map((column, columnIndex) => (
						<div
							key={column.join("-")}
							// On a phone the two columns are one list, so only the first one draws the top rule.
							className={cn(
								"border-foreground/12",
								columnIndex === 0 ? "border-t" : "min-[56.25rem]:border-t",
							)}
						>
							{column.map((id, index) => (
								<details
									key={id}
									open={index === 0}
									className="sp-faq border-foreground/12 border-b"
								>
									<summary className="relative cursor-pointer py-4.5 pe-8 font-display text-[1.0625rem] leading-[1.35] tracking-[-0.01em]">
										{t(`faq.${id}.question`)}
									</summary>
									<p className="pe-5 pb-5 text-[0.9375rem] text-muted-foreground leading-[1.7]">
										{t(`faq.${id}.answer`)}
									</p>
								</details>
							))}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
