// The visit section: a head, the room tour, and one caption line that gives the month of the photos.
// LandingPage renders it on the second ground. Its id "visit" is the target of the header link.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CAPTION, SECTION, WRAP } from "../lib/type-styles";
import { RoomTour } from "./room-tour";
import { SectionHead } from "./section-head";

/** The head splits 6 to 6: its paragraph is the longest of the page. */
export function VisitSection() {
	const { t } = useT();
	return (
		<section
			id="visit"
			aria-labelledby="visit-title"
			className={cn(SECTION, "scroll-mt-16 bg-canvas")}
		>
			<div className={WRAP}>
				<SectionHead
					titleId="visit-title"
					label={t("visit.label")}
					titleLines={[t("visit.titleLine1"), t("visit.titleLine2")]}
					lede={t("visit.lede")}
					split="6/6"
					className="mb-[clamp(2rem,3.4vw,3rem)]"
				/>
				<RoomTour />
				<p className={cn(CAPTION, "mt-[1.1rem]")}>{t("visit.caption")}</p>
			</div>
		</section>
	);
}
