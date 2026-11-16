// The visit request: two choices, a villa and an evening, then one link that opens the email of the visitor.
// ContactSection renders it. It posts no data: the link is a "mailto:" address with the request written in the body.
// STARTER.md says how to replace it with a real form.
import { useState } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BUTTON, CAPTION, TEXT_LINK, TEXT_LINK_RULE } from "../lib/type-styles";
import { RequestField } from "./request-field";

/** The villa choices of the first field. The last one is for a visitor with no choice yet. */
const VILLA_KEYS: readonly TranslationKey[] = [
	"contact.villaPin",
	"contact.villaCypres",
	"contact.villaPalmier",
	"contact.villaUndecided",
];

/** The visit evenings: Sunday to Thursday, the working week in Algeria. */
const EVENING_KEYS: readonly TranslationKey[] = [
	"contact.eveningSunday",
	"contact.eveningMonday",
	"contact.eveningTuesday",
	"contact.eveningWednesday",
	"contact.eveningThursday",
];

/** The link changes with the two choices. With no script the link holds the first choice of each field. */
export function VisitRequest() {
	const { t } = useT();
	const [villaIndex, setVillaIndex] = useState(0);
	const [eveningIndex, setEveningIndex] = useState(0);
	const villaKey = VILLA_KEYS[villaIndex] ?? "contact.villaUndecided";
	const eveningKey = EVENING_KEYS[eveningIndex] ?? "contact.eveningSunday";
	// The visitor completes the two last lines in the email. "%0A" is a line break in a mailto body.
	const mailBody = [
		`${t("contact.mailVillaLine")} ${t(villaKey)}`,
		`${t("contact.mailEveningLine")} ${t(eveningKey)}`,
		`${t("contact.mailNameLine")} `,
		`${t("contact.mailPhoneLine")} `,
	]
		.map((line) => encodeURIComponent(line))
		.join("%0A");
	const mailHref = `${t("contact.emailHref")}?subject=${encodeURIComponent(t("contact.mailSubject"))}&body=${mailBody}`;
	return (
		<div className="mt-[clamp(1.8rem,3vw,2.6rem)] grid gap-x-[1.6rem] gap-y-6 sm:grid-cols-2">
			<RequestField
				label={t("contact.villaField")}
				optionKeys={VILLA_KEYS}
				selectedIndex={villaIndex}
				onSelect={setVillaIndex}
			/>
			<RequestField
				label={t("contact.eveningField")}
				optionKeys={EVENING_KEYS}
				selectedIndex={eveningIndex}
				onSelect={setEveningIndex}
			/>
			<div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-2">
				<a href={mailHref} className={BUTTON}>
					{t("contact.send")}
				</a>
				<a href={t("site.phoneHref")} className={TEXT_LINK}>
					{/* The number comes from `site`, so one key holds the telephone for the whole page. */}
					<span className={TEXT_LINK_RULE}>
						{`${t("contact.orCall")} ${t("site.phoneDisplay")}`}
					</span>
				</a>
			</div>
			<p className={cn(CAPTION, "max-w-[44ch] text-[0.85rem] sm:col-span-2")}>
				{t("contact.privacy")}
			</p>
		</div>
	);
}
