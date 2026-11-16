// The house: four rooms in a staggered triptych, with the tea tray photo in the middle column.
// LandingPage renders it after the water band. The outer columns start at different depths, as a slow tide.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PHOTOS } from "../lib/photos";
import {
	BODY_TEXT,
	LABEL,
	SECTION_TITLE,
	SECTION_Y,
	WRAP,
} from "../lib/styles";
import { GradedPhoto } from "./graded-photo";
import { RoomNote } from "./room-note";
import { SteamVeil } from "./steam-veil";

/** The <section id="house"> that the header link "the house" opens. */
export function HouseSection() {
	const { t } = useT();
	return (
		<section
			id="house"
			aria-labelledby="house-title"
			className={cn("relative bg-background", SECTION_Y)}
		>
			<SteamVeil kind="seam" phase={3} />
			<div className={cn(WRAP, "relative z-3")}>
				<div
					data-reveal=""
					className="flex flex-wrap items-end justify-between gap-[1.4rem]"
				>
					<div>
						<p className={LABEL}>{t("house.label")}</p>
						<h2
							id="house-title"
							className={cn(SECTION_TITLE, "mt-4 max-w-[16ch]")}
						>
							{t("house.title")}
						</h2>
					</div>
					<p className={cn(BODY_TEXT, "max-w-[36ch] text-[0.95rem]")}>
						{t("house.intro")}
					</p>
				</div>
				<div className="mt-[clamp(2.4rem,5.5vh,4rem)] grid grid-cols-1 items-start gap-[clamp(1.4rem,3vw,2.4rem)] sm:grid-cols-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(0,0.9fr)] lg:gap-[clamp(1.6rem,3.2vw,3.4rem)]">
					<div className="grid gap-[clamp(1.5rem,3vh,2.3rem)] lg:pt-[clamp(1rem,4vh,3rem)]">
						<RoomNote
							label={t("house.room1Label")}
							title={t("house.room1Title")}
							body={t("house.room1Body")}
							fact={t("house.room1Fact")}
						/>
						<RoomNote
							label={t("house.room2Label")}
							title={t("house.room2Title")}
							body={t("house.room2Body")}
							fact={t("house.room2Fact")}
						/>
					</div>
					{/* Below 1024px the photo opens the grid on its own row. */}
					<div
						data-reveal=""
						className="-order-1 sm:col-span-2 lg:order-none lg:col-span-1"
					>
						<GradedPhoto
							photo={PHOTOS.teaTray}
							alt={t("house.teaAlt")}
							maskClassName="h-[clamp(300px,46vh,460px)] rounded-lg lg:h-[clamp(320px,44vh,460px)]"
							imageClassName="object-[50%_55%]"
							note={t("house.teaCaption")}
						/>
					</div>
					<div className="grid gap-[clamp(1.5rem,3vh,2.3rem)] lg:pt-[clamp(1.6rem,7vh,5rem)]">
						<RoomNote
							label={t("house.room3Label")}
							title={t("house.room3Title")}
							body={t("house.room3Body")}
							fact={t("house.room3Fact")}
						/>
						<RoomNote
							label={t("house.room4Label")}
							title={t("house.room4Title")}
							body={t("house.room4Body")}
							fact={t("house.room4Fact")}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
