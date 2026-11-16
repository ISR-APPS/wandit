// The week: a centered head, then a grid of seven class rows by seven days, with a dot on each day a class runs.
// LandingPage renders it on the surface bone. It reads WEEK_ROWS and WEEK_DAYS of lib/schedule.ts.
// Below 560px the grid scrolls sideways inside its own frame and the class names wrap and stay pinned; the page never does.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PRACTICE_NAME_KEYS, WEEK_DAYS, WEEK_ROWS } from "../lib/schedule";
import { LEDE, SECTION_TITLE, SECTION_Y, WRAP } from "../lib/styles";
import { Eyebrow } from "./eyebrow";

/** A dot of the grid: sage for a class, clay for the candlelit breathwork. */
function dotClass(isCandlelit: boolean) {
	return cn(
		"sp-dot inline-block size-[11px] rounded-full",
		isCandlelit ? "bg-(--sp-terra)" : "bg-(--sp-sage)",
	);
}

/** The schedule section, anchor #schedule. */
export function ScheduleSection() {
	const { t } = useT();
	return (
		<section
			id="schedule"
			aria-labelledby="schedule-title"
			className={`${SECTION_Y} border-(--sp-line-soft) border-y bg-(--sp-surface)`}
		>
			<div className={WRAP}>
				<div className="mb-[clamp(48px,7vw,84px)] text-center">
					<Eyebrow centered>{t("schedule.eyebrow")}</Eyebrow>
					<h2
						id="schedule-title"
						data-reveal
						className={`${SECTION_TITLE} mx-auto mt-[22px] max-w-[16ch]`}
					>
						{t("schedule.titleLead")}{" "}
						<em className="italic">{t("schedule.titleEm")}</em>
					</h2>
					<p data-reveal className={`${LEDE} mx-auto mt-5`}>
						{t("schedule.lede")}
					</p>
				</div>
				<div data-reveal className="sp-table-scroll overflow-x-auto rounded-xl">
					<table className="w-full min-w-[480px] border-collapse">
						<caption className="sr-only">{t("schedule.caption")}</caption>
						<thead>
							<tr className="border-(--sp-line) border-b">
								<th
									scope="col"
									className="sticky start-0 z-1 bg-(--sp-surface) pb-3.5 md:static"
								>
									<span className="sr-only">{t("schedule.classColumn")}</span>
								</th>
								{WEEK_DAYS.map((day) => (
									<th
										key={day.shortKey}
										scope="col"
										className="px-1.5 pb-3.5 text-center font-bold font-sans text-(--sp-ink-64) text-[0.7rem] uppercase tracking-[0.24em] md:px-2.5"
									>
										<span aria-hidden="true">{t(day.shortKey)}</span>
										<span className="sr-only">{t(day.fullKey)}</span>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{WEEK_ROWS.map((row) => {
								const isCandlelit = row.practice === "breathwork";
								return (
									<tr
										key={`${row.time}-${row.practice}`}
										className="sp-row group border-(--sp-line-soft) border-b transition-colors duration-700 last:border-b-0 hover:bg-primary/8"
									>
										<th
											scope="row"
											className="sticky start-0 z-1 w-[7.5rem] bg-(--sp-surface) py-[17px] ps-1 pe-5 text-start font-normal md:static md:w-auto md:whitespace-nowrap md:bg-transparent md:pe-[26px]"
										>
											<span className="block font-bold font-sans text-(--sp-ink-64) text-[0.72rem] tabular-nums tracking-[0.18em]">
												{row.time}
											</span>
											<span className="mt-0.5 block font-display text-[1.18rem] leading-[1.2] transition-colors duration-700 group-hover:text-primary">
												{t(PRACTICE_NAME_KEYS[row.practice])}
											</span>
										</th>
										{row.days.map((runs, dayIndex) => (
											<td
												// The seven cells of a row never move, so the day index is a stable key.
												key={WEEK_DAYS[dayIndex]?.shortKey}
												className="px-1.5 py-[17px] text-center md:px-2.5"
											>
												{runs ? (
													<>
														<span
															aria-hidden="true"
															className={dotClass(isCandlelit)}
														/>
														<span className="sr-only">
															{t("schedule.runs")}
														</span>
													</>
												) : (
													<span className="sr-only">
														{t("schedule.closed")}
													</span>
												)}
											</td>
										))}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<p
					aria-hidden="true"
					className="mt-4 text-center font-bold font-sans text-(--sp-ink-64) text-[0.7rem] uppercase tracking-[0.24em] min-[560px]:hidden"
				>
					{t("schedule.swipe")}
				</p>
				<div
					data-reveal
					className="mt-[26px] flex flex-wrap gap-x-[34px] gap-y-2.5 text-(--sp-ink-78) text-[0.85rem]"
				>
					<span className="inline-flex items-center gap-[9px]">
						<span aria-hidden="true" className={dotClass(false)} />
						{t("schedule.legendRuns")}
					</span>
					<span className="inline-flex items-center gap-[9px]">
						<span aria-hidden="true" className={dotClass(true)} />
						{t("schedule.legendCandle")}
					</span>
					<span>{t("schedule.legendCap")}</span>
				</div>
			</div>
		</section>
	);
}
