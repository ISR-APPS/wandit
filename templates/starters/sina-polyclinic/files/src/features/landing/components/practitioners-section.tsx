// The practitioners: a sticky title column with a short roster, beside four cards and the photo of an examination room.
// Below 900px the roster moves under the cards.
// LandingPage renders it. The photo takes two rows of the card grid, so its caption ends with the second card.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PRACTITIONER_IDS } from "../lib/content";
import { WRAP } from "../lib/type-styles";
import { PhotoPlate } from "./photo-plate";
import { PractitionerCard } from "./practitioner-card";
import { RosterList } from "./roster-list";
import { TitleColumn } from "./title-column";

/** The section with the id "practitioners". From 900px the title column stays in view while the cards scroll. */
export function PractitionersSection() {
	const { t } = useT();
	return (
		<section
			id="practitioners"
			aria-labelledby="practitioners-title"
			className="scroll-mt-16 py-(--sp-rhythm)"
		>
			<div
				className={cn(
					WRAP,
					"grid gap-[clamp(28px,4vw,64px)] min-[56.25rem]:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] min-[56.25rem]:items-start",
				)}
			>
				<TitleColumn
					tone="ground"
					label={t("team.label")}
					title={t("team.title")}
					titleId="practitioners-title"
					body={t("team.body")}
					signLine={t("team.signLine")}
					signNote={t("team.signNote")}
					// 100px: the 66px of the sticky header and a gap.
					className="min-[56.25rem]:sticky min-[56.25rem]:top-25"
				>
					{/* Below 900px the column stacks above the cards. The roster is secondary, so it moves under them. */}
					<RosterList className="hidden min-[56.25rem]:block" />
				</TitleColumn>
				{/* mt-2: the top edge of the grid lands on the hairline of the section label beside it. */}
				<div className="grid gap-[clamp(14px,1.6vw,22px)] md:grid-cols-2 min-[56.25rem]:mt-2">
					<PhotoPlate
						src="/images/exam-room.webp"
						alt={t("team.photoAlt")}
						width={1433}
						height={1920}
						caption={t("team.photoCaption")}
						className="flex flex-col md:row-span-2"
						frameClassName="aspect-3/4 md:aspect-auto md:min-h-75 md:flex-1"
					/>
					{PRACTITIONER_IDS.map((id) => (
						<PractitionerCard key={id} id={id} />
					))}
				</div>
				<RosterList className="mt-0 min-[56.25rem]:hidden" />
			</div>
		</section>
	);
}
