// The study request sheet of the contact section: the visitor picks a project type and a plot location,
// and the sheet writes the subject of the email. "Write to the studio" opens a mailto: link with that subject.
// ContactSection renders it. It posts no data: STARTER.md says where a real form with a table goes.
import { useState } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { PLOT_PLACES, PROJECT_TYPES } from "../lib/content";
import { BUTTON_GHOST, BUTTON_PRIMARY, LABEL, SHEET } from "../lib/styles";
import { ChoiceGroup } from "./choice-group";

/** A sheet panel with two choice groups, the subject line, and two actions. */
export function StudyRequest() {
	const { t } = useT();
	const [projectType, setProjectType] =
		useState<TranslationKey>("contact.typeVilla");
	const [plotPlace, setPlotPlace] = useState<TranslationKey>(
		"contact.placeElBiar",
	);
	const subject = `${t("contact.subjectPrefix")} — ${t(projectType)} — ${t(plotPlace)}`;
	const mailHref = `${t("site.emailHref")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(t("contact.bodyTemplate"))}`;
	return (
		<div
			data-reveal
			className={`ns-rise ${SHEET} p-[clamp(1.5rem,3vw,2.25rem)]`}
		>
			<p
				className={`${LABEL} mb-6 font-normal text-[0.625rem] text-foreground/70`}
			>
				{t("contact.requestFolio")}
			</p>
			<div className="grid gap-7">
				<ChoiceGroup
					legend="contact.typeLegend"
					name="project-type"
					options={PROJECT_TYPES}
					value={projectType}
					onChange={setProjectType}
				/>
				<ChoiceGroup
					legend="contact.placeLegend"
					name="plot-place"
					options={PLOT_PLACES}
					value={plotPlace}
					onChange={setPlotPlace}
				/>
				<div className="border-[1.5px] border-foreground/35 border-dashed bg-background/60 px-4 py-3.5">
					<p
						className={`${LABEL} font-normal text-[0.5625rem] text-foreground/60`}
					>
						{t("contact.subjectLabel")}
					</p>
					<p aria-live="polite" className="mt-1.5 font-medium text-[1.0625rem]">
						{subject}
					</p>
				</div>
			</div>
			<div className="mt-7 flex flex-wrap items-center gap-4">
				<a href={mailHref} className={BUTTON_PRIMARY}>
					{t("contact.write")}
				</a>
				<a href={t("site.phoneHref")} className={BUTTON_GHOST}>
					{t("contact.call")}
				</a>
			</div>
			<p
				className={`${LABEL} mt-5 font-normal text-[0.625rem] text-foreground/60`}
			>
				{t("contact.note")}
			</p>
		</div>
	);
}
