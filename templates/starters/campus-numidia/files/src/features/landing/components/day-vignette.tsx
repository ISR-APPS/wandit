// The day vignette of the hero: one posted day of the timetable, four slots side by side.
// HeroSection renders it above the campus photo. It reads the Tuesday column of lib/timetable.ts,
// so every cell here also exists in the full week further down the page.
import { useT } from "~/shared/i18n";
import {
	TIMETABLE_CELLS,
	TIMETABLE_HOURS,
	VIGNETTE_DAY,
} from "../lib/timetable";
import { CourseBlock } from "./course-block";

const DAY_CELLS = TIMETABLE_CELLS.filter((cell) => cell.day === VIGNETTE_DAY);

/** White sheet with a 2px navy rule. Four columns from 900px, two on a phone. */
export function DayVignette() {
	const { t } = useT();
	return (
		<aside
			aria-label={t("hero.vignetteLabel")}
			className="cn-r cn-bleed border border-border bg-card px-[clamp(16px,1.6vw,22px)] pt-[15px] pb-[17px]"
		>
			<p className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-foreground border-b-2 pb-2.5">
				<b className="font-bold font-display text-[0.9375rem] tracking-[-0.018em]">
					{t("hero.vignetteTitle")}
				</b>
				<span className="text-[0.8125rem] text-muted-foreground">
					{t("hero.vignetteNote")}
				</span>
			</p>
			<div className="grid grid-cols-2 gap-2 min-[900px]:grid-cols-4">
				{DAY_CELLS.map((cell) => (
					<div key={cell.id} className="flex min-w-0 flex-col gap-[5px]">
						<span className="ps-[3px] font-semibold text-[0.6875rem] text-muted-foreground tabular-nums leading-none tracking-[0.06em]">
							{TIMETABLE_HOURS[cell.row]}
						</span>
						<CourseBlock cell={cell} size="day" />
					</div>
				))}
			</div>
		</aside>
	);
}
