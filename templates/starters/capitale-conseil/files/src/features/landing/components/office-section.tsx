// The head office: a label rail beside one wide duotone plate. LandingPage renders it before the contact.
// It gives the long run of ledgers its photograph back. From 900px the plate has a fixed height, not a ratio.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { MICRO, MOVEMENT, SOFT } from "../lib/type-styles";
import { DuotonePlate } from "./duotone-plate";
import { SectionLabel } from "./section-label";

/** Two sentences about the place, then the facade of the tower at dusk with its caption ledger. */
export function OfficeSection() {
	const { t } = useT();
	return (
		<section className={cn(MOVEMENT, "border-foreground/12 border-t")}>
			<div className="cap-wrap grid grid-cols-1 items-start gap-[clamp(1.4rem,3vw,3rem)] min-[56.25rem]:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
				<div data-reveal>
					<SectionLabel className="mb-[1.2rem]">
						{t("office.label")}
					</SectionLabel>
					<p className={cn(SOFT, "max-w-[34ch] text-[0.90625rem]")}>
						{t("office.text")}
					</p>
				</div>
				<div data-reveal>
					<DuotonePlate
						src="/images/tower-facade.webp"
						alt={t("office.plateAlt")}
						width={1400}
						height={1867}
						isLazy
						// The top half of the photo is sky. The crop keeps a thin band of sky and fills the frame with the glass grid.
						frameClassName="aspect-[4/3] [&_img]:object-[50%_75%] min-[56.25rem]:aspect-auto min-[56.25rem]:h-[clamp(320px,44vh,440px)] min-[56.25rem]:[&_img]:object-[50%_62%]"
						captionLine={t("office.plateLine")}
						captionNote={t("office.plateNote")}
						captionSide={
							<span className={cn(MICRO, "pb-0.5 text-foreground/60")}>
								{t("office.plateSide")}
							</span>
						}
					/>
				</div>
			</div>
		</section>
	);
}
