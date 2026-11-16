// Page 4 of the paper, "Our past front pages": the history of the café told as four framed editions.
// LandingPage renders it after the menu. An intro and a figures box come first, then the edition cards.
import { useT } from "~/shared/i18n";
import { PAPER_FIGURES, PAST_EDITIONS } from "../lib/content";
import { SectionHead } from "./section-head";

/** The archive strip: 4 cards on a wide screen, 2 on a tablet, 1 on a phone. */
export function ArchivesSection() {
	const { t } = useT();
	return (
		<section
			id="archives"
			aria-labelledby="archives-title"
			data-roll-group
			className="ks-wrap ks-section"
		>
			<SectionHead
				titleId="archives-title"
				pageKey="archives.page"
				titleKey="archives.title"
				noteKey="archives.note"
			/>
			<div className="mb-10 grid items-start gap-[clamp(1.8rem,3.5vw,3rem)] min-[768px]:grid-cols-[1.15fr_0.85fr]">
				<p data-roll className="ks-roll max-w-[60ch] text-[1.08rem]">
					{t("archives.intro")}
				</p>
				<dl
					data-roll
					aria-label={t("archives.figuresLabel")}
					className="ks-roll grid grid-cols-3 gap-5 border border-(--ks-rule-strong) bg-canvas px-5 py-4.5"
				>
					{PAPER_FIGURES.map((figure) => (
						<div key={figure.labelKey} className="grid content-start">
							<dt className="row-start-2 mt-1 font-sans font-semibold text-[0.68rem] text-foreground/70 uppercase leading-snug tracking-[0.1em]">
								{t(figure.labelKey)}
							</dt>
							<dd className="row-start-1 font-display font-extrabold text-[clamp(1.6rem,2.4vw,2.1rem)] lining-nums tabular-nums leading-[1.1]">
								{figure.value}
							</dd>
						</div>
					))}
				</dl>
			</div>
			<div className="grid gap-6 min-[1100px]:grid-cols-4 min-[640px]:grid-cols-2">
				{PAST_EDITIONS.map((edition) => (
					<article
						key={edition.numberKey}
						data-roll
						className="ks-roll border border-(--ks-rule-strong) bg-canvas px-5 pt-4.5 pb-5"
					>
						<p className="font-sans text-[0.7rem] uppercase tracking-[0.1em]">
							<span className="font-bold text-primary">
								{t(edition.numberKey)}
							</span>
							<span className="ms-2 text-foreground/62">
								{t(edition.dateKey)}
							</span>
						</p>
						<p
							aria-hidden="true"
							className="mb-2.5 border-foreground border-b-2 pt-2 pb-1 font-display font-extrabold text-[1.05rem]"
						>
							{t("site.brand")}
						</p>
						<h3 className="mb-2 font-display font-extrabold text-[1.3rem] leading-[1.12]">
							{t(edition.titleKey)}
						</h3>
						<p className="text-[0.88rem] text-foreground/85 leading-normal">
							{t(edition.bodyKey)}
						</p>
					</article>
				))}
			</div>
		</section>
	);
}
