// The treatment menu: a sticky title column, closed by the linen photo, beside five ruled price rows.
// LandingPage renders it after the ritual. Each row name links to the booking section.
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
import { PebbleDivider } from "./pebble-divider";
import { SteamVeil } from "./steam-veil";
import { TreatmentRow } from "./treatment-row";

/** The <section id="treatments"> that the header link "treatments" opens. */
export function TreatmentsSection() {
	const { t } = useT();
	const included = [
		t("treatments.included1"),
		t("treatments.included2"),
		t("treatments.included3"),
		t("treatments.included4"),
	];
	return (
		<section
			id="treatments"
			aria-labelledby="treatments-title"
			className={cn("relative bg-background", SECTION_Y)}
		>
			<SteamVeil kind="seam" phase={2} />
			<div
				className={cn(
					WRAP,
					"relative z-3 grid grid-cols-1 gap-[clamp(2rem,4vh,3rem)] md:grid-cols-[minmax(0,0.82fr)_minmax(0,1.5fr)] md:gap-[clamp(2rem,4vw,5rem)] lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.6fr)]",
				)}
			>
				{/* The column sticks while the rows pass. It stays under one screen tall, or it stops sticking. */}
				<div className="md:sticky md:top-[clamp(2rem,8vh,4rem)] md:self-start">
					<div data-reveal="">
						<p className={LABEL}>{t("treatments.label")}</p>
						<h2
							id="treatments-title"
							className={cn(SECTION_TITLE, "mt-4 mb-[1.2rem]")}
						>
							{t("treatments.title")}
						</h2>
						<p className={cn(BODY_TEXT, "max-w-[40ch] text-[0.95rem]")}>
							{t("treatments.intro")}
						</p>
					</div>
					<PebbleDivider phase={1} className="mt-7" />
					<div data-reveal="" className="mt-6">
						<p className={LABEL}>{t("treatments.includedLabel")}</p>
						<ul className="m-0 mt-3.5 grid list-none gap-2 p-0">
							{included.map((item) => (
								<li
									key={item}
									className="relative ps-[1.1rem] text-(--onde-ink-72) text-[0.9rem] before:absolute before:start-0 before:top-[0.62em] before:size-[5px] before:rounded-full before:bg-(--onde-sage)"
								>
									{item}
								</li>
							))}
						</ul>
					</div>
					<GradedPhoto
						photo={PHOTOS.linen}
						alt={t("treatments.linenAlt")}
						maskClassName="aspect-[5/4] rounded-lg"
						imageClassName="object-[50%_66%]"
						note={t("treatments.linenCaption")}
						className="mt-[clamp(1.6rem,3.2vh,2.4rem)] max-w-[380px] md:max-w-none"
					/>
				</div>
				<div>
					<ul
						aria-label={t("treatments.listLabel")}
						className="m-0 list-none border-(--onde-hair) border-t p-0"
					>
						<TreatmentRow
							name={t("treatments.hammamName")}
							body={t("treatments.hammamBody")}
							duration={t("treatments.hammamDuration")}
							price={t("treatments.hammamPrice")}
						/>
						<TreatmentRow
							name={t("treatments.ritualName")}
							body={t("treatments.ritualBody")}
							duration={t("treatments.ritualDuration")}
							price={t("treatments.ritualPrice")}
						/>
						<TreatmentRow
							name={t("treatments.arganName")}
							body={t("treatments.arganBody")}
							duration={t("treatments.arganDuration")}
							price={t("treatments.arganPrice")}
						/>
						<TreatmentRow
							name={t("treatments.clayName")}
							body={t("treatments.clayBody")}
							duration={t("treatments.clayDuration")}
							price={t("treatments.clayPrice")}
						/>
						<TreatmentRow
							name={t("treatments.dayName")}
							body={t("treatments.dayBody")}
							duration={t("treatments.dayDuration")}
							price={t("treatments.dayPrice")}
						/>
					</ul>
					<p
						data-reveal=""
						className="mt-6 text-(--onde-ink-66) text-[0.82rem]"
					>
						{t("treatments.note")}
					</p>
				</div>
			</div>
		</section>
	);
}
