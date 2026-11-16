// Page 5 of the paper, "Letters to the editor": the intro column, the letter of the week, and the clip-out coupon.
// LandingPage renders it last, before the imprint. The coupon posts no data: its actions open a mail or a call.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { DATELINE, PROSE_LINK } from "../lib/type-styles";
import { LettersCoupon } from "./letters-coupon";
import { SectionHead } from "./section-head";
import { Slug } from "./slug";

/** The intro on the start side, the coupon on the end side. Under 980px the coupon follows the intro. */
export function LettersSection() {
	const { t } = useT();
	return (
		<section
			id="letters"
			aria-labelledby="letters-title"
			data-roll-group
			className="ks-wrap ks-section"
		>
			<SectionHead
				titleId="letters-title"
				pageKey="letters.page"
				titleKey="letters.title"
				noteKey="letters.note"
			/>
			<div className="grid items-start gap-[clamp(2.4rem,4vw,3.5rem)] min-[980px]:grid-cols-[0.8fr_1.2fr]">
				<div data-roll className="ks-roll">
					<div className="max-w-[62ch] space-y-3.5">
						<p>
							<span className={DATELINE}>{t("letters.introDateline")}</span>{" "}
							{t("letters.intro1")}
						</p>
						<p>
							{t("letters.intro2Lead")}{" "}
							<a
								href={t("site.phoneHref")}
								className={cn(PROSE_LINK, "whitespace-nowrap")}
							>
								{t("site.phoneDisplay")}
							</a>{" "}
							{t("letters.intro2Tail")}
						</p>
						<p>{t("letters.intro3")}</p>
					</div>
					<aside
						aria-label={t("letters.letterSlug")}
						className="mt-7 border border-(--ks-rule-strong) bg-canvas px-5 py-4.5"
					>
						<Slug className="mb-2.5">{t("letters.letterSlug")}</Slug>
						<blockquote>
							<p className="italic leading-[1.55]">
								{t("letters.letterQuote")}
							</p>
							<footer className="mt-2.5 font-sans text-[0.72rem] text-foreground/62 uppercase tracking-[0.1em]">
								{t("letters.letterFrom")}
							</footer>
						</blockquote>
					</aside>
				</div>
				<div data-roll className="ks-roll">
					<LettersCoupon />
				</div>
			</div>
		</section>
	);
}
