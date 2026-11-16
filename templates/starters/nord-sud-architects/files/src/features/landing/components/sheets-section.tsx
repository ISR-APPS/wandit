// PL·03, three recent projects as drawing sheets in an uneven mosaic: one sheet of 7 columns, one of 5 set lower,
// and one wide sheet under a dimension line that measures it. LandingPage renders it after the plan.
// The project texts are in the `sheets` group of messages.ts; the figures are one component each.
import { useT } from "~/shared/i18n";
import { formatWholeArea } from "../lib/format";
import { SECTION } from "../lib/styles";
import { BologhineSheetPlan } from "./bologhine-sheet-plan";
import { CasbahSheetSection } from "./casbah-sheet-section";
import { LauriersSheetElevation } from "./lauriers-sheet-elevation";
import { MeasuredCote } from "./measured-cote";
import { ProjectSheet } from "./project-sheet";
import { SectionHead } from "./section-head";

// The width of the wide sheet at 1440px. The server render prints it until the browser measures.
const WIDE_SHEET_PX = 1240;

/** One column on a phone. From 1024px the two upper sheets share a 12-column row. */
export function SheetsSection() {
	const { t, locale } = useT();
	const factCells = (
		place: string,
		squareMetres: number,
		year: number,
		status: string,
	) => [
		{ label: t("sheets.place"), value: place },
		{ label: t("sheets.area"), value: formatWholeArea(locale, squareMetres) },
		{ label: t("sheets.year"), value: String(year) },
		{ label: t("sheets.status"), value: status },
	];
	return (
		<section
			id="sheets"
			aria-labelledby="sheets-title"
			className={`${SECTION} ns-paper`}
		>
			<div className="ns-wrap">
				<SectionHead
					folio="sheets.folio"
					title="sheets.title"
					titleId="sheets-title"
				/>
				<div className="grid grid-cols-1 gap-[clamp(1.25rem,2.5vw,2rem)] lg:grid-cols-12">
					<ProjectSheet
						layout="stacked"
						className="lg:col-span-7"
						name={t("sheets.bologhineName")}
						folio={t("sheets.bologhineFolio")}
						body={t("sheets.bologhineBody")}
						cells={factCells(
							t("sheets.bologhinePlace"),
							240,
							2025,
							t("sheets.bologhineStatus"),
						)}
						figure={<BologhineSheetPlan />}
					/>
					<ProjectSheet
						layout="stacked"
						className="lg:col-span-5 lg:self-end"
						name={t("sheets.lauriersName")}
						folio={t("sheets.lauriersFolio")}
						body={t("sheets.lauriersBody")}
						cells={factCells(
							t("sheets.lauriersPlace"),
							1850,
							2024,
							t("sheets.lauriersStatus"),
						)}
						figure={<LauriersSheetElevation />}
					/>
					<div className="mt-4 lg:col-span-12">
						<MeasuredCote
							label="sheets.coteLabel"
							fallbackWidth={WIDE_SHEET_PX}
							className="mb-3"
						/>
						<ProjectSheet
							layout="wide"
							name={t("sheets.casbahName")}
							folio={t("sheets.casbahFolio")}
							body={t("sheets.casbahBody")}
							cells={factCells(
								t("sheets.casbahPlace"),
								380,
								2026,
								t("sheets.casbahStatus"),
							)}
							figure={<CasbahSheetSection />}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
