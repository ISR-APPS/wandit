// The edition seal: tracked micro capitals on a circle around one brass orb. It turns once in 30 s.
// HeroStage renders it outside the top corner of the hero frame. landing.css places it and spins it.
import { useId } from "react";
import { useT } from "~/shared/i18n";

/** Decorative: the edition size is also in the hero eyebrow, so screen readers skip the seal. */
export function EditionSeal() {
	const { t } = useT();
	// The text path needs a document-unique id. useId keeps it the same on the server and in the browser.
	const pathId = useId();
	return (
		<div className="lume-seal lume-enter-soft" aria-hidden="true">
			<svg viewBox="0 0 100 100">
				<title>{t("hero.seal")}</title>
				<defs>
					<path
						id={pathId}
						d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"
					/>
				</defs>
				<text className="fill-current font-medium font-sans text-[8.6px] uppercase tracking-[0.25em]">
					<textPath href={`#${pathId}`}>{t("hero.seal")}</textPath>
				</text>
				<circle cx="50" cy="50" r="4.5" className="fill-primary" />
			</svg>
		</div>
	);
}
