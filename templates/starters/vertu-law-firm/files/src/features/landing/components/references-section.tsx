// "References", the second cream interlude: one client quote opened by the 3px brass bar, and three figures beside it.
// LandingPage renders it. The page has exactly one quote, attributed to a role and a sector, never to a portrait.
import { useT } from "~/shared/i18n";
import { FACTS } from "../lib/content";
import { SectionHead } from "./section-head";

/** One client quote with a 3px brass bar, and three figures in a hairline column beside it. */
export function ReferencesSection() {
	const { t } = useT();
	return (
		<section
			id="references"
			aria-labelledby="references-title"
			className="vt-cream vt-section"
		>
			<div className="vt-wrap">
				<SectionHead tab="references.tab" note="references.note" />
				<h2 id="references-title" className="sr-only">
					{t("references.title")}
				</h2>
				<div className="grid gap-12 lg:grid-cols-[1.55fr_0.75fr] lg:gap-[clamp(2rem,4.5vw,4.5rem)]">
					<figure
						data-reveal
						className="m-0 grid gap-4 sm:grid-cols-[auto_1fr] sm:gap-[clamp(1rem,2.4vw,2.2rem)]"
					>
						<span
							aria-hidden="true"
							className="vt-quote-bar sm:mt-[clamp(1rem,1.9vw,1.75rem)]"
						/>
						<div>
							<blockquote className="m-0 font-display text-[clamp(1.42rem,3.5vw,3.05rem)] leading-[1.24] tracking-[-0.012em]">
								{t("references.quoteStart")}{" "}
								<em className="italic">{t("references.quoteEmphasis")}</em>{" "}
								{t("references.quoteEnd")}
							</blockquote>
							<figcaption className="vt-line mt-7 flex flex-wrap gap-x-7 gap-y-1.5 border-t pt-4 text-(--vt-ink-70) text-[0.95rem]">
								<span className="font-display text-(--vt-ink) text-[1.06rem]">
									{t("references.quoteRole")}
								</span>
								<span>{t("references.quoteSector")}</span>
								<span>{t("references.quoteSince")}</span>
							</figcaption>
						</div>
					</figure>
					<dl data-reveal="end" className="vt-line self-start border-t">
						{FACTS.map((fact) => (
							<div
								key={fact.value}
								className="vt-faint border-b py-4 last:border-b-0"
							>
								<dt className="font-display text-(--vt-brass) text-[clamp(1.6rem,2.8vw,2.3rem)] tabular-nums leading-none">
									{t(fact.value)}
								</dt>
								<dd className="mt-2 text-(--vt-ink-70) text-[0.92rem]">
									{t(fact.label)}
								</dd>
							</div>
						))}
					</dl>
				</div>
			</div>
		</section>
	);
}
