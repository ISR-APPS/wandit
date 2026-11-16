// "The firm": a sticky lead column beside the four house rules, Art. 1 to Art. 4. Ground B, the raised file.
// LandingPage renders it after the hero. The rules come from HOUSE_RULES of lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { HOUSE_RULES } from "../lib/content";
import { LABEL, SECTION_TITLE } from "../lib/type-styles";
import { ClauseHead } from "./clause-head";
import { SectionHead } from "./section-head";

/** The clause stack. On a wide screen the lead column stays in view while the rules scroll past. */
export function FirmSection() {
	const { t } = useT();
	return (
		<section
			id="firm"
			aria-labelledby="firm-title"
			className="vt-band-b vt-section"
		>
			<div className="vt-wrap">
				<SectionHead tab="firm.tab" note="firm.note" />
				<div className="grid gap-10 lg:grid-cols-[4.2fr_7fr] lg:gap-[clamp(2rem,5vw,5.5rem)]">
					<div data-reveal className="self-start lg:sticky lg:top-28">
						<h2 id="firm-title" className={cn(SECTION_TITLE, "mb-5")}>
							{t("firm.title")}
						</h2>
						<p className="max-w-[38ch] text-(--vt-ink-70)">{t("firm.body")}</p>
						<p className="vt-line mt-8 flex items-baseline gap-3 border-t pt-4">
							<span className="font-display text-(--vt-brass) text-[clamp(2rem,3.4vw,2.9rem)] tabular-nums leading-none">
								{t("firm.sinceYear")}
							</span>
							<span className={cn(LABEL, "text-(--vt-brass)")}>
								{t("firm.sinceLabel")}
							</span>
						</p>
					</div>
					<div>
						{HOUSE_RULES.map((rule) => (
							<article
								key={rule.article}
								data-reveal
								className="vt-faint border-b py-6 first:pt-0 last:border-b-0"
							>
								<ClauseHead article={rule.article}>{t(rule.title)}</ClauseHead>
								<p className="mt-2.5 max-w-[62ch] text-(--vt-ink-70)">
									{t(rule.body)}
								</p>
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
