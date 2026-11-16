// The practices: a section head, then four day panels in one rounded band, from dawn to night.
// LandingPage renders it. The band is 1420px at most and runs almost to the screen edge, wider than the column.
// Four panels on a wide screen, two from 621px to 1080px, one on a phone.
import { useT } from "~/shared/i18n";
import { LEDE, SECTION_TITLE, SECTION_Y, WRAP } from "../lib/styles";
import { DayPanel } from "./day-panel";
import { Eyebrow } from "./eyebrow";

/** The practices section, anchor #practices. */
export function PracticesSection() {
	const { t } = useT();
	return (
		<section
			id="practices"
			aria-labelledby="practices-title"
			className={SECTION_Y}
		>
			<div className={`${WRAP} mb-[clamp(48px,7vw,84px)]`}>
				<Eyebrow>{t("practices.eyebrow")}</Eyebrow>
				<h2
					id="practices-title"
					data-reveal
					className={`${SECTION_TITLE} mt-[22px] max-w-[16ch]`}
				>
					{t("practices.titleLead")}{" "}
					<em className="whitespace-nowrap italic">{t("practices.titleEm")}</em>
				</h2>
				<p data-reveal className={`${LEDE} mt-5`}>
					{t("practices.lede")}
				</p>
			</div>
			<div className="px-2.5">
				<div
					data-reveal-group
					className="sp-band mx-auto grid max-w-[1420px] overflow-hidden rounded-2xl min-[1081px]:grid-cols-4 min-[621px]:grid-cols-2"
				>
					<DayPanel
						hour="dawn"
						whenKey="practices.dawnWhen"
						titleKey="practices.dawnTitle"
						bodyKey="practices.dawnBody"
						levelKey="practices.dawnLevel"
						artKey="practices.dawnArt"
					/>
					<DayPanel
						hour="midday"
						whenKey="practices.middayWhen"
						titleKey="practices.middayTitle"
						bodyKey="practices.middayBody"
						levelKey="practices.middayLevel"
						artKey="practices.middayArt"
					/>
					<DayPanel
						hour="golden"
						whenKey="practices.goldenWhen"
						titleKey="practices.goldenTitle"
						bodyKey="practices.goldenBody"
						levelKey="practices.goldenLevel"
						artKey="practices.goldenArt"
					/>
					<DayPanel
						hour="night"
						whenKey="practices.nightWhen"
						titleKey="practices.nightTitle"
						bodyKey="practices.nightBody"
						levelKey="practices.nightLevel"
						artKey="practices.nightArt"
					/>
				</div>
			</div>
		</section>
	);
}
