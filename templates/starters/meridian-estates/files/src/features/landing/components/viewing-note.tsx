// The viewing note of the contact section: the visitor picks a house and a time of day, the note shows
// the email subject that it writes, and "Request private viewing" opens a mailto: link with that subject.
// ContactSection renders it. It posts no data: STARTER.md says where a real form with a table goes.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { HOUSE_CHOICES, LIGHT_CHOICES } from "../lib/content";
import { ChoiceGroup } from "./choice-group";

/** Two choice groups, the live subject line, and the mail action. The first house is the default. */
export function ViewingNote() {
	const { t } = useT();
	const [houseId, setHouseId] = useState(HOUSE_CHOICES[0]?.id ?? "");
	const [lightId, setLightId] = useState(LIGHT_CHOICES[0]?.id ?? "");
	const house = HOUSE_CHOICES.find((choice) => choice.id === houseId);
	const light = LIGHT_CHOICES.find((choice) => choice.id === lightId);
	const subject = [
		t("contact.subjectPrefix"),
		house === undefined ? null : house.label.map((key) => t(key)).join(" "),
		light === undefined ? null : light.label.map((key) => t(key)).join(" "),
	]
		.filter((part) => part !== null)
		.join(" — ");
	const mailHref = `${t("site.emailHref")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(t("contact.bodyTemplate"))}`;
	return (
		<div data-reveal className="mer-rise flex flex-col gap-10 [--mer-step:1]">
			<ChoiceGroup
				legend="contact.houseLegend"
				name="viewing-house"
				choices={HOUSE_CHOICES}
				value={houseId}
				onChange={setHouseId}
				layout="list"
			/>
			<ChoiceGroup
				legend="contact.lightLegend"
				name="viewing-light"
				choices={LIGHT_CHOICES}
				value={lightId}
				onChange={setLightId}
				layout="row"
			/>
			<div className="border-foreground/8 border-s ps-5">
				<p className="text-[0.65625rem] text-foreground/55 uppercase tracking-[0.2em]">
					{t("contact.subjectLabel")}
				</p>
				<p
					aria-live="polite"
					className="mt-2 font-display text-[clamp(1.2rem,1.8vw,1.5rem)] text-foreground/90 italic leading-snug"
				>
					{subject}
				</p>
			</div>
			<div className="flex flex-col items-start gap-x-8 gap-y-4 sm:flex-row sm:items-center">
				<a
					href={mailHref}
					className="inline-flex min-h-12 items-center rounded-full border border-primary/55 px-9 text-[0.71875rem] text-primary uppercase tracking-[0.2em] transition-colors duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground"
				>
					{t("contact.submit")}
				</a>
				<p className="text-balance text-[0.75rem] text-foreground/55 leading-[1.6] sm:max-w-[30ch]">
					{t("contact.note")}
				</p>
			</div>
		</div>
	);
}
