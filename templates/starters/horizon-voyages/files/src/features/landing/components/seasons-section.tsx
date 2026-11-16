// Section 04, "the season band": the one deep band of the page. It holds data, never a photo.
// LandingPage renders it. The matrix is a real table: destinations down the start side, twelve months across, three states.
// The data is in lib/seasons.ts. On reveal the cells fade in column by column, like the year passing.
import { type TranslationKey, useT } from "~/shared/i18n";
import {
	MONTHS,
	SEASON_ROWS,
	type SeasonState,
	STATE_KEYS,
} from "../lib/seasons";
import {
	BODY,
	type CssVariableStyle,
	FIGURE,
	META,
	META_SMALL,
	SECTION,
	WRAP,
} from "../lib/type-styles";
import { SectionHead } from "./section-head";

/** One fact row of the side column. */
type ClimateFact = {
	labelKey: TranslationKey;
	valueKey: TranslationKey;
};

/** Three measured facts behind the three rules. */
const CLIMATE_FACTS: readonly ClimateFact[] = [
	{ labelKey: "seasons.nightLabel", valueKey: "seasons.nightValue" },
	{ labelKey: "seasons.seaLabel", valueKey: "seasons.seaValue" },
	{ labelKey: "seasons.windLabel", valueKey: "seasons.windValue" },
];

/** The legend order: from the best month to a closed month. */
const LEGEND_STATES: readonly SeasonState[] = [2, 1, 0];

/** The deep band with the matrix, the legend, and the side column of rules. */
export function SeasonsSection() {
	const { t } = useT();
	return (
		<section
			id="seasons"
			aria-labelledby="seasons-title"
			className={`${SECTION} hz-deep`}
		>
			<div className={WRAP}>
				<SectionHead
					label={t("seasons.label")}
					title={t("seasons.title")}
					titleId="seasons-title"
					note={t("seasons.note")}
				/>
				<div className="grid items-start gap-x-[clamp(24px,4vw,60px)] gap-y-12 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,286px)]">
					<div data-reveal>
						<table className="w-full table-fixed border-collapse">
							<caption className="sr-only">{t("seasons.caption")}</caption>
							<thead>
								<tr>
									<th
										scope="col"
										className="hz-season-first pb-3 text-start font-semibold text-(--hz-ink-soft) text-[10px] uppercase leading-[1.5] tracking-[0.08em] min-[900px]:text-[10.5px] min-[900px]:tracking-[0.16em]"
									>
										{t("seasons.destination")}
									</th>
									{MONTHS.map((month) => (
										<th
											key={month.nameKey}
											scope="col"
											className="pb-3 text-center font-semibold text-[10px] uppercase tracking-[0.12em]"
										>
											<abbr title={t(month.nameKey)} className="no-underline">
												<span className="max-[899px]:hidden">
													{t(month.nameKey)}
												</span>
												<span className="min-[900px]:hidden">
													{t(month.initialKey)}
												</span>
											</abbr>
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{SEASON_ROWS.map((row) => (
									<tr key={row.id} className="border-(--hz-hair) border-t">
										<th
											scope="row"
											className={`${FIGURE} h-[50px] pe-2.5 text-start align-middle text-[0.8rem] leading-[1.24] min-[900px]:h-14 min-[900px]:pe-5 min-[900px]:text-[clamp(0.86rem,1.05vw,1.05rem)]`}
										>
											{t(row.labelKey)}
										</th>
										{row.months.map((state, monthIndex) => {
											const sweep: CssVariableStyle = {
												"--hz-col": String(monthIndex),
											};
											return (
												<td
													key={MONTHS[monthIndex]?.nameKey}
													className="hz-season-cell text-center align-middle"
													style={sweep}
												>
													{/* landing.css draws the state: a filled sun block, a sun outline, or one thin line. */}
													<span
														aria-hidden="true"
														className="hz-state"
														data-state={state}
													/>
													<span className="sr-only">
														{t(STATE_KEYS[state])}
													</span>
												</td>
											);
										})}
									</tr>
								))}
							</tbody>
						</table>
						<ul className={`${META_SMALL} mt-[26px] flex flex-wrap gap-[22px]`}>
							{LEGEND_STATES.map((state) => (
								<li key={state} className="inline-flex items-center gap-[9px]">
									<span
										aria-hidden="true"
										className="hz-state"
										data-state={state}
									/>
									{t(STATE_KEYS[state])}
								</li>
							))}
						</ul>
					</div>
					<div data-reveal className="hz-rise">
						<p className={`${META}`}>{t("seasons.rulesLabel")}</p>
						<p className={`${BODY} mt-3.5`}>{t("seasons.rulesBody")}</p>
						<table className="mt-[26px] w-full border-collapse">
							<tbody>
								{CLIMATE_FACTS.map((fact) => (
									<tr
										key={fact.labelKey}
										className="border-(--hz-hair) border-y"
									>
										<th
											scope="row"
											className={`${META_SMALL} py-[11px] pe-4 text-start align-baseline`}
										>
											{t(fact.labelKey)}
										</th>
										<td
											className={`${FIGURE} whitespace-nowrap py-[11px] text-end align-baseline text-[1.06rem] tabular-nums`}
										>
											{t(fact.valueKey)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</section>
	);
}
