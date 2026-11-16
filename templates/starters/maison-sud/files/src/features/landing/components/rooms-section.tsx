// The rooms section: the visit of House N°7, room by room, on the second ground of the page.
// LandingPage renders it. The hero itinerary announces these five rooms; RoomWalk walks them.
import { useT } from "~/shared/i18n";
import { WRAP } from "../lib/type-styles";
import { RoomWalk } from "./room-walk";
import { SectionHead } from "./section-head";

/** Section "The rooms". It is the one moving scene of the page. The scroll margin is the height of the sticky header. */
export function RoomsSection() {
	const { t } = useT();
	return (
		<section
			id="rooms"
			className="scroll-mt-28 bg-canvas pt-(--ms-rhythm) pb-[clamp(2.6rem,4.5vw,4.4rem)] md:scroll-mt-19"
		>
			<div className={WRAP}>
				<SectionHead
					label={t("rooms.label")}
					titleLines={[t("rooms.title1"), t("rooms.title2")]}
					note={t("rooms.note")}
				/>
				<RoomWalk />
			</div>
		</section>
	);
}
