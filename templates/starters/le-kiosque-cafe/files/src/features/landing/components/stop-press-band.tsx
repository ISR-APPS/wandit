// The stop-press band: the one ink-ground strip of the paper, with a brick tag and one factual line.
// LandingPage renders it after the showpiece. The tag stamps in when the band scrolls into view.
import { useT } from "~/shared/i18n";

/** Paper text on ink. The world allows this inversion once per page. */
export function StopPressBand() {
	const { t } = useT();
	return (
		<section
			aria-label={t("stopPress.label")}
			data-roll-group
			className="bg-foreground py-6 text-background"
		>
			<div className="ks-wrap flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-center">
				<span
					data-stamp
					className="ks-stamp shrink-0 bg-primary px-[0.9em] py-[0.4em] font-bold font-sans text-[0.74rem] text-primary-foreground uppercase tracking-[0.14em]"
				>
					{t("stopPress.tag")}
				</span>
				<p data-roll className="ks-roll text-[1.05rem]">
					{t("stopPress.lead")} <b>{t("stopPress.when")}</b>
					{t("stopPress.tail")}
				</p>
			</div>
		</section>
	);
}
