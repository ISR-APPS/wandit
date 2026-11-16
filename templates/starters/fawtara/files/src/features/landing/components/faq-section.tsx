// The folded FAQ: four native details elements on hairlines, beside the section head and a link to the contact section.
// LandingPage renders it. The browser opens and closes each answer, so no script is needed.
// landing.css turns the plus of an open question by 45 degrees.
import { useT } from "~/shared/i18n";
import { SECTION_SPACE, WRAP } from "../lib/class-names";
import { ArrowLink } from "./arrow-link";
import { SectionHead } from "./section-head";

const QUESTIONS = [
	{ questionKey: "faq.question1", answerKey: "faq.answer1" },
	{ questionKey: "faq.question2", answerKey: "faq.answer2" },
	{ questionKey: "faq.question3", answerKey: "faq.answer3" },
	{ questionKey: "faq.question4", answerKey: "faq.answer4" },
] as const;

/** The first question starts open, so the visitor sees the form of an answer. */
export function FaqSection() {
	const { t } = useT();
	return (
		<section id="faq" aria-label={t("faq.label")} className={SECTION_SPACE}>
			<div
				className={`${WRAP} grid gap-[clamp(2rem,4vw,4rem)] md:grid-cols-[1fr_1.6fr]`}
			>
				<div>
					<SectionHead
						label={t("faq.label")}
						title={t("faq.title")}
						lead={t("faq.lead")}
					/>
					<div data-reveal className="mt-3 [--fw-delay:120ms]">
						<ArrowLink href="#contact">{t("faq.more")}</ArrowLink>
					</div>
				</div>
				<div data-reveal className="fw-faq border-foreground/10 border-t">
					{QUESTIONS.map((item, index) => (
						<details
							key={item.questionKey}
							open={index === 0 ? true : undefined}
							className="border-foreground/10 border-b"
						>
							<summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-1 py-4 font-display font-semibold text-[1.08rem] leading-snug">
								{t(item.questionKey)}
								<svg
									width="18"
									height="18"
									viewBox="0 0 18 18"
									aria-hidden="true"
									className="fw-plus shrink-0 text-primary"
								>
									<path
										d="M9 3v12M3 9h12"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
									/>
								</svg>
							</summary>
							<p className="max-w-[56ch] px-1 pb-5 text-muted-foreground leading-[1.65]">
								{t(item.answerKey)}
							</p>
						</details>
					))}
				</div>
			</div>
		</section>
	);
}
