// "Fees", Art. 5: the published fee scale beside the four-step procedure, closed by the recessed fee-agreement block.
// LandingPage renders it on ground B. The scale lines come from FEE_LINES, the steps from PROCEDURE_STEPS.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CONSULTATION_HREF, FEE_LINES, PROCEDURE_STEPS } from "../lib/content";
import { BUTTON_TEXT, LABEL, SECTION_TITLE } from "../lib/type-styles";
import { DossierTab } from "./dossier-tab";
import { SectionHead } from "./section-head";

/** Two columns on a wide screen. Below 640px each amount drops under its name. */
export function FeesSection() {
	const { t } = useT();
	return (
		<section
			id="fees"
			aria-labelledby="fees-title"
			className="vt-band-b vt-section"
		>
			<div className="vt-wrap">
				<SectionHead tab="fees.tab" note="fees.note" />
				<div className="grid gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-[clamp(2rem,5vw,5rem)]">
					<div>
						<h2
							id="fees-title"
							data-reveal
							className={cn(SECTION_TITLE, "text-balance")}
						>
							{/* One line per sentence on a wide screen, so the break never falls after "The". */}
							<span className="block">{t("fees.titleLine1")}</span>{" "}
							<span className="block">{t("fees.titleLine2")}</span>
						</h2>
						<dl className="vt-line mt-8 border-t">
							{FEE_LINES.map((line) => (
								<div
									key={line.name}
									data-reveal
									className="vt-faint grid gap-x-6 gap-y-1 border-b py-4 sm:grid-cols-[1fr_auto] sm:items-baseline"
								>
									<dt className="font-display text-[1.12rem] leading-[1.3]">
										{t(line.name)}
									</dt>
									<dd className="whitespace-nowrap font-display text-(--vt-brass) text-[clamp(1.15rem,1.6vw,1.45rem)] tabular-nums sm:row-span-2 sm:text-end">
										{line.prefix !== undefined && (
											<span className="me-1.5 text-(--vt-ink-70) text-[0.85em]">
												{t(line.prefix)}
											</span>
										)}
										{t(line.amount)}{" "}
										<span
											className={cn(
												LABEL,
												"text-[11px] normal-case tracking-[0.1em]",
											)}
										>
											{t(line.unit)}
										</span>
									</dd>
									<dd className="max-w-[46ch] text-pretty text-(--vt-ink-50) text-[0.8rem] leading-normal sm:row-start-2">
										{t(line.note)}
									</dd>
								</div>
							))}
						</dl>
						<p
							data-reveal
							className="mt-5 max-w-[56ch] text-(--vt-ink-50) text-[0.8rem] leading-relaxed"
						>
							{t("fees.footnote")} {t("fees.seeAlso")}{" "}
							<a href="#firm" className="vt-renvoi">
								{t("fees.seeAlsoLink")}
							</a>
							{t("fees.seeAlsoEnd")}
						</p>
					</div>

					<div>
						<p
							data-reveal="end"
							className={cn(LABEL, "vt-line border-b pb-3.5 text-(--vt-brass)")}
						>
							{t("fees.procedureLabel")}
						</p>
						<ol>
							{PROCEDURE_STEPS.map((step, index) => (
								<li
									key={step.title}
									data-reveal="end"
									className="vt-faint grid grid-cols-[2.4rem_1fr] gap-4 border-b py-5"
								>
									<span
										aria-hidden="true"
										className="font-display text-(--vt-brass) text-[clamp(1.7rem,2.6vw,2.3rem)] tabular-nums leading-[0.95]"
									>
										{index + 1}
									</span>
									<div>
										<h3 className="mb-1.5 font-display font-normal text-[1.1rem]">
											{t(step.title)}
										</h3>
										<p className="max-w-[44ch] text-pretty text-(--vt-ink-70) text-[0.95rem]">
											{t(step.body)}
										</p>
									</div>
								</li>
							))}
						</ol>
						<div data-reveal="end" className="mt-[clamp(1.8rem,3.4vw,2.6rem)]">
							<DossierTab
								size="section"
								className="relative z-10 [--tab-fill:var(--vt-recess)]"
							>
								{t("fees.agreementTab")}
							</DossierTab>
							<div className="vt-stock bg-(--vt-recess) p-[clamp(1.4rem,2.4vw,1.9rem)]">
								<h3 className="mb-3 text-balance font-display font-normal text-[clamp(1.15rem,1.7vw,1.4rem)] leading-[1.25]">
									{t("fees.agreementTitle")}
								</h3>
								<p className="mb-5 max-w-[42ch] text-pretty text-(--vt-ink-70) text-[0.95rem]">
									{t("fees.agreementBody")}
								</p>
								<a
									href={CONSULTATION_HREF}
									className={cn("vt-btn vt-btn-ghost", BUTTON_TEXT)}
								>
									{t("fees.agreementCta")}
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
