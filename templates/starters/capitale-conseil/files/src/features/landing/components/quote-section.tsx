// The one client quote of the page, on the pale steel ground. LandingPage renders it after the case study.
// Three columns from 900px: the label, the quote with its attribution, and a ledger of the mandate.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { QUOTE_FACTS } from "../lib/content";
import { LABEL, MOVEMENT, SOFT, TERM } from "../lib/type-styles";
import { SectionLabel } from "./section-label";

/** A static quote in the serif face. The page has one quote and no carousel. */
export function QuoteSection() {
	const { t } = useT();
	return (
		<section className={cn(MOVEMENT, "cap-steel")}>
			<div className="cap-wrap grid grid-cols-1 items-start gap-[1.6rem] min-[56.25rem]:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,13rem)] min-[56.25rem]:gap-[clamp(1.6rem,3vw,3rem)]">
				<SectionLabel data-reveal>{t("quote.label")}</SectionLabel>
				<figure data-reveal>
					<blockquote className="max-w-[26ch] font-display text-[clamp(1.5rem,2.6vw,2.2rem)] leading-[1.28] tracking-[-0.01em] min-[56.25rem]:max-w-[34ch]">
						{t("quote.text")}
					</blockquote>
					<figcaption
						className={cn(LABEL, "mt-[1.6rem] flex gap-3 text-primary")}
					>
						{/* The dash sits on the first line when the attribution wraps. */}
						<span
							aria-hidden="true"
							className="mt-[0.6em] h-px w-6 shrink-0 bg-current"
						/>
						<span>{t("quote.attribution")}</span>
					</figcaption>
				</figure>
				<dl data-reveal className="border-foreground/18 border-t">
					{QUOTE_FACTS.map((fact) => (
						<div key={fact} className="border-foreground/12 border-b py-3">
							<dt className={TERM}>{t(`quote.${fact}Label`)}</dt>
							<dd className={cn(SOFT, "mt-1 text-sm")}>
								{t(`quote.${fact}Value`)}
							</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	);
}
