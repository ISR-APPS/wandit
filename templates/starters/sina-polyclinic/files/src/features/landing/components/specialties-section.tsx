// The fee register: the nine specialties of the clinic as a table of hairlines, not as cards.
// LandingPage renders it under the hero. The rows come from SPECIALTY_IDS of lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { SPECIALTY_IDS } from "../lib/content";
import { LABEL, LEDE, SECTION_TITLE, WRAP } from "../lib/type-styles";
import { SectionLabel } from "./section-label";
import { REGISTER_COLUMNS, SpecialtyRow } from "./specialty-row";

// The three notes under the register: a strong start and the rest of the sentence.
const FOOT_NOTES = [
	{ lead: "specialties.footBilling", text: "specialties.footBillingText" },
	{ lead: "specialties.footChildren", text: "specialties.footChildrenText" },
	{ lead: "specialties.footReport", text: "specialties.footReportText" },
] as const;

/** The section with the id "specialties". An ink rule opens the register, and three notes close it. */
export function SpecialtiesSection() {
	const { t } = useT();
	return (
		<section
			id="specialties"
			aria-labelledby="specialties-title"
			className="scroll-mt-16 py-[clamp(3.4rem,6vw,5.5rem)]"
		>
			<div className={WRAP}>
				<SectionLabel tone="ground">{t("specialties.label")}</SectionLabel>
				<div className="mb-[clamp(30px,4vw,52px)] grid gap-4.5 min-[56.25rem]:grid-cols-[1.15fr_0.85fr] min-[56.25rem]:items-end min-[56.25rem]:gap-[clamp(24px,4vw,64px)]">
					<h2
						id="specialties-title"
						className={cn(
							SECTION_TITLE,
							"max-w-[22ch] min-[56.25rem]:max-w-[17ch]",
						)}
					>
						{t("specialties.title")}
					</h2>
					<p className={LEDE}>{t("specialties.lede")}</p>
				</div>
				{/* The column heads repeat what each row shows, so a screen reader skips them. */}
				<div
					aria-hidden="true"
					className={cn(
						LABEL,
						"hidden pb-3 text-muted-foreground tracking-[0.14em] md:grid",
						REGISTER_COLUMNS,
					)}
				>
					<span>{t("specialties.columnSpecialty")}</span>
					<span>{t("specialties.columnPractitioner")}</span>
					<span className="flex justify-end gap-[clamp(14px,1.6vw,26px)]">
						<span>{t("specialties.columnDuration")}</span>
						<span className="min-w-24.5 text-end">
							{t("specialties.columnFee")}
						</span>
					</span>
				</div>
				<ul className="border-foreground border-t">
					{SPECIALTY_IDS.map((id) => (
						<SpecialtyRow key={id} id={id} />
					))}
				</ul>
				<p className="flex flex-wrap gap-x-6.5 gap-y-2.5 pt-5 text-muted-foreground text-sm">
					{FOOT_NOTES.map((note) => (
						<span key={note.lead}>
							<b className="font-medium text-foreground">{t(note.lead)}</b>{" "}
							{t(note.text)}
						</span>
					))}
				</p>
			</div>
		</section>
	);
}
