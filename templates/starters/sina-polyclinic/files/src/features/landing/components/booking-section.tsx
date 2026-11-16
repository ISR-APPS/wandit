// The booking section: the slot picker and the list of what to bring, beside the waiting room photo and the hours.
// LandingPage renders it. The two columns end on the same line: the last plate of each column takes the free height.
import { useT } from "~/shared/i18n";
import { WRAP } from "../lib/type-styles";
import { AccessPlate } from "./access-plate";
import { BringList } from "./bring-list";
import { PhotoPlate } from "./photo-plate";
import { SectionLabel } from "./section-label";
import { SlotPicker } from "./slot-picker";

const COLUMN = "flex flex-col gap-[clamp(18px,2.2vw,28px)]";

/** The section with the id "booking". Every booking action of the page goes to it. */
export function BookingSection() {
	const { t } = useT();
	return (
		<section
			id="booking"
			aria-labelledby="booking-title"
			className="scroll-mt-16 py-(--sp-rhythm)"
		>
			<div className={WRAP}>
				<SectionLabel tone="ground">{t("booking.label")}</SectionLabel>
				<div className="grid gap-[clamp(24px,3.2vw,48px)] min-[56.25rem]:grid-cols-[minmax(0,1.28fr)_minmax(0,0.72fr)]">
					<div className={COLUMN}>
						<SlotPicker />
						<BringList className="flex-1" />
					</div>
					<div className={COLUMN}>
						<PhotoPlate
							src="/images/waiting-room.webp"
							alt={t("booking.photoAlt")}
							width={1600}
							height={893}
							caption={t("booking.photoCaption")}
							frameClassName="aspect-16/11"
						/>
						<AccessPlate className="flex-1" />
					</div>
				</div>
			</div>
		</section>
	);
}
