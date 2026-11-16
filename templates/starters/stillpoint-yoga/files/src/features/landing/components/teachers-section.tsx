// The teachers: a section head, then four teacher cards in two columns. The second column sits lower.
// LandingPage renders it. The names are fictional sample content.
import { useT } from "~/shared/i18n";
import { LEDE, SECTION_TITLE, SECTION_Y, WRAP } from "../lib/styles";
import { Eyebrow } from "./eyebrow";
import { TeacherCard } from "./teacher-card";

/** The teachers section, anchor #teachers. One column below 768px. */
export function TeachersSection() {
	const { t } = useT();
	return (
		<section
			id="teachers"
			aria-labelledby="teachers-title"
			className={`${SECTION_Y} pb-[clamp(140px,16vh,210px)]`}
		>
			<div className={WRAP}>
				<div className="mb-[clamp(48px,7vw,84px)]">
					<Eyebrow>{t("teachers.eyebrow")}</Eyebrow>
					<h2
						id="teachers-title"
						data-reveal
						className={`${SECTION_TITLE} mt-[22px] max-w-[16ch]`}
					>
						{t("teachers.titleLead")}{" "}
						<em className="italic">{t("teachers.titleEm")}</em>{" "}
						{t("teachers.titleTail")}
					</h2>
					<p data-reveal className={`${LEDE} mt-5`}>
						{t("teachers.lede")}
					</p>
				</div>
				<div className="grid gap-[clamp(20px,3vw,40px)] md:grid-cols-2">
					<TeacherCard
						pose="seated"
						nameKey="teachers.maraName"
						roleKey="teachers.maraRole"
						lineKey="teachers.maraLine"
						artKey="teachers.maraArt"
					/>
					<TeacherCard
						pose="teaser"
						nameKey="teachers.jonahName"
						roleKey="teachers.jonahRole"
						lineKey="teachers.jonahLine"
						artKey="teachers.jonahArt"
					/>
					<TeacherCard
						pose="kneeling"
						nameKey="teachers.priyaName"
						roleKey="teachers.priyaRole"
						lineKey="teachers.priyaLine"
						artKey="teachers.priyaArt"
					/>
					<TeacherCard
						pose="fold"
						nameKey="teachers.tomasName"
						roleKey="teachers.tomasRole"
						lineKey="teachers.tomasLine"
						artKey="teachers.tomasArt"
					/>
				</div>
			</div>
		</section>
	);
}
