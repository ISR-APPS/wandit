// What members say on the way out: three quotes in large italic serif, at the start, the end, and the middle.
// LandingPage renders it after the memberships. The quotes and first names are fictional sample content.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { SECTION_Y, WRAP } from "../lib/styles";
import { Eyebrow } from "./eyebrow";

/** The three quotes, each with where it sits in the column. */
const WHISPERS = [
	{ quoteKey: "whispers.quote1", citeKey: "whispers.cite1", place: "start" },
	{ quoteKey: "whispers.quote2", citeKey: "whispers.cite2", place: "end" },
	{ quoteKey: "whispers.quote3", citeKey: "whispers.cite3", place: "center" },
] as const;

/** The whispers section. On a phone every quote sits at the start. */
export function WhispersSection() {
	const { t } = useT();
	return (
		<section aria-labelledby="whispers-title" className={SECTION_Y}>
			<div className={WRAP}>
				<h2 id="whispers-title" className="mb-[clamp(48px,7vw,84px)]">
					<Eyebrow>{t("whispers.eyebrow")}</Eyebrow>
				</h2>
				<div className="flex flex-col gap-[clamp(44px,7vw,88px)]">
					{WHISPERS.map((whisper) => (
						<blockquote
							key={whisper.quoteKey}
							data-reveal
							className={cn(
								"w-fit max-w-full",
								whisper.place === "end" && "md:self-end md:text-end",
								whisper.place === "center" && "md:self-center",
							)}
						>
							<p className="sp-quote max-w-[30ch] text-pretty font-display text-[clamp(1.6rem,3.2vw,2.65rem)] italic leading-[1.34] tracking-[-0.01em]">
								{t(whisper.quoteKey)}
							</p>
							<footer
								className={cn(
									"mt-[22px] flex items-center gap-3.5 font-bold font-sans text-(--sp-ink-64) text-[0.75rem] uppercase tracking-[0.24em]",
									whisper.place === "end" && "md:justify-end",
								)}
							>
								<span
									aria-hidden="true"
									className="h-px w-[30px] shrink-0 bg-(--sp-sage)"
								/>
								<cite className="not-italic">{t(whisper.citeKey)}</cite>
							</footer>
						</blockquote>
					))}
				</div>
			</div>
		</section>
	);
}
