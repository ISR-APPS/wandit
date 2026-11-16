// The questions chapter: a short aside with the atelier email, beside five questions that open one at a time.
// LandingPage renders it after the reserve chapter. The "Questions" link of the header jumps here.
import { useId, useState } from "react";
import { useT } from "~/shared/i18n";
import { ATELIER_EMAIL, ATELIER_MAILTO } from "../lib/offer";
import { CHAPTER, WRAP } from "../lib/type-styles";
import { SectionHead } from "./section-head";

/** Grid .8fr / 1.2fr: the heading column is the small one. The first answer is open at load. */
export function FaqSection() {
	const { t } = useT();
	const baseId = useId();
	// Index of the open answer. -1 when all are closed. Opening one closes the others.
	const [openIndex, setOpenIndex] = useState(0);
	const items = [
		{ question: t("faq.q1"), answer: t("faq.a1") },
		{ question: t("faq.q2"), answer: t("faq.a2") },
		{ question: t("faq.q3"), answer: t("faq.a3") },
		{ question: t("faq.q4"), answer: t("faq.a4") },
		{ question: t("faq.q5"), answer: t("faq.a5") },
	];
	return (
		<section
			id="questions"
			aria-labelledby="faq-title"
			className={`${CHAPTER} scroll-mt-[4.5rem]`}
		>
			<div
				className={`${WRAP} grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-[clamp(2rem,6vw,6rem)]`}
			>
				<div data-reveal>
					<SectionHead
						kicker={t("faq.kicker")}
						title={t("faq.title")}
						turn={t("faq.titleTurn")}
						titleId="faq-title"
					/>
					<p className="mt-[1.4rem] max-w-[24em] text-foreground/72">
						{t("faq.asideLead")}{" "}
						<a
							href={ATELIER_MAILTO}
							className="text-(--lume-brass-deep) underline underline-offset-4"
						>
							{ATELIER_EMAIL}
						</a>
						{t("faq.asideEnd")}
					</p>
				</div>
				<div data-reveal className="border-foreground/16 border-t">
					{items.map((item, index) => {
						const isOpen = index === openIndex;
						const buttonId = `${baseId}-q${index}`;
						const panelId = `${baseId}-a${index}`;
						return (
							<div
								key={item.question}
								className="border-foreground/16 border-b"
							>
								<h3>
									<button
										type="button"
										id={buttonId}
										aria-expanded={isOpen}
										aria-controls={panelId}
										onClick={() => setOpenIndex(isOpen ? -1 : index)}
										className="flex w-full cursor-pointer items-center justify-between gap-6 py-[1.4rem] text-start font-display font-medium text-[clamp(1.05rem,1.6vw,1.3rem)] transition-colors duration-300 hover:text-(--lume-brass-deep) aria-expanded:text-(--lume-brass-deep)"
									>
										{item.question}
										<span
											aria-hidden="true"
											className="lume-plus relative size-[1.05rem] flex-none"
										/>
									</button>
								</h3>
								<section
									id={panelId}
									aria-labelledby={buttonId}
									data-open={isOpen}
									className="lume-answer"
								>
									<div className="overflow-hidden">
										{/* A closed answer stays in the HTML for the height animation, so screen readers skip it. */}
										<p
											className="max-w-[38em] pb-6 text-foreground/72"
											aria-hidden={!isOpen}
										>
											{item.answer}
										</p>
									</div>
								</section>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
