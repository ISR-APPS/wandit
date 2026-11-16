// The practical info. A giant cobalt "?" fronts four questions in display caps,
// each with a short answer, split by 2px rules. LandingPage renders it on cream, the paper breath.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { QUESTIONS } from "../lib/content";
import { LABEL, SHEET_PAD, SUB_DISPLAY, WRAP } from "../lib/type-styles";

/** The "?" takes the end column from 1024px. On a phone it sits under the answers, in the bottom padding. */
export function InfoSection() {
	const { t } = useT();
	return (
		<section
			id="info"
			aria-labelledby="info-title"
			className="sf-cream relative overflow-clip"
		>
			<p
				aria-hidden="true"
				data-slab=""
				data-watch="parent"
				data-from="end"
				className="sf-glyph absolute -end-[0.04em] bottom-[0.1em] font-display text-[14rem] text-primary lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2 lg:text-[clamp(20rem,78vh,42rem)]"
			>
				?
			</p>
			<div
				className={cn(
					WRAP,
					SHEET_PAD,
					"relative pb-[15rem] lg:grid lg:grid-cols-[1.25fr_0.75fr] lg:gap-[clamp(2rem,5vw,5rem)] lg:pb-[clamp(4.5rem,10vh,8rem)]",
				)}
			>
				<div>
					<div data-slab="">
						<p className={LABEL}>{t("info.label")}</p>
						<h2 id="info-title" className={cn(SUB_DISPLAY, "mt-5 mb-10")}>
							{t("info.title")}
						</h2>
					</div>
					<dl className="border-current border-b-2">
						{QUESTIONS.map((question) => (
							<div
								key={question.id}
								data-slab=""
								className="border-current border-t-2 py-7"
							>
								<dt className="mb-2.5 font-display text-[clamp(1.6rem,2.8vw,2.4rem)] uppercase leading-[1.05] tracking-[0.01em]">
									{t(question.questionKey)}
								</dt>
								<dd className="max-w-[34em] text-[1.02rem]">
									{t(question.answerKey)}
								</dd>
							</div>
						))}
					</dl>
				</div>
			</div>
		</section>
	);
}
