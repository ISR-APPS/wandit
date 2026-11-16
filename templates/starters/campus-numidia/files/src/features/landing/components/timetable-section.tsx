// The timetable section: the full posted week of Year 2 computing on a white sheet over a pale sky ground.
// LandingPage renders it after the programmes. It reads lib/timetable.ts and draws each cell with CourseBlock.
// Under 900px the grid scrolls sideways inside the sheet; the page itself never scrolls sideways.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	COURSE_KIND_LABELS,
	COURSE_KINDS,
	TIMETABLE_CELLS,
	TIMETABLE_DAYS,
	TIMETABLE_HOURS,
	type TimetableCell,
} from "../lib/timetable";
import { BAND, CHIP_CAPS, LEDE, WRAP } from "../lib/type-styles";
import { CourseBlock } from "./course-block";
import { SectionHead } from "./section-head";

/** The week sheet with its head line, its colour key, the grid, and the notes under it. */
export function TimetableSection() {
	const { t } = useT();
	// The sr-only prefix of a block, for example "Tue 10, 08:30".
	const slotLabel = (cell: TimetableCell) => {
		const day = TIMETABLE_DAYS[cell.day];
		const hour = TIMETABLE_HOURS[cell.row];
		return day === undefined ? hour : `${t(day.labelKey)} ${day.date}, ${hour}`;
	};
	const rooms = [
		{ name: t("timetable.roomHallA"), detail: t("timetable.roomHallADetail") },
		{ name: t("timetable.roomB"), detail: t("timetable.roomBDetail") },
		{ name: t("timetable.roomC04"), detail: t("timetable.roomC04Detail") },
		{ name: t("timetable.roomLabs"), detail: t("timetable.roomLabsDetail") },
	];
	return (
		<section
			id="timetable"
			aria-labelledby="timetable-title"
			className={`${BAND} bg-(--cn-pale)`}
		>
			<div className={WRAP}>
				<SectionHead
					headingId="timetable-title"
					eyebrow={t("timetable.eyebrow")}
					title={t("timetable.title")}
					aside={<p className={LEDE}>{t("timetable.lede")}</p>}
				/>
				<div data-pop="" className="cn-r bg-card p-[clamp(16px,2vw,26px)]">
					<div className="mb-[clamp(14px,1.8vw,20px)] flex flex-wrap items-baseline justify-between gap-x-4.5 gap-y-2.5 border-foreground border-b-2 pb-3.5">
						<b className="font-bold font-display text-[clamp(1rem,1.3vw,1.18rem)] tracking-[-0.018em]">
							{t("timetable.sheetTitle")}
						</b>
						<span className="text-[0.8125rem] text-muted-foreground">
							{t("timetable.sheetNote")}
						</span>
					</div>
					<ul
						aria-label={t("timetable.legendLabel")}
						className="mb-[clamp(14px,1.7vw,20px)] flex flex-wrap gap-2"
					>
						{COURSE_KINDS.map((kind) => (
							<li
								key={kind}
								// The chip takes the fill of its blocks, so every chip points to a real cell.
								className={cn(
									CHIP_CAPS,
									"border",
									`cn-course-${kind}`,
									kind === "optional" && "text-(--cn-ink-2)",
								)}
							>
								{t(COURSE_KIND_LABELS[kind])}
							</li>
						))}
					</ul>
					<p className="mb-1 border-border border-b pt-1 pb-2.5 text-[0.8125rem] text-muted-foreground min-[900px]:hidden">
						{t("timetable.scrollHint")}
					</p>
					{/* relative: the sr-only slot labels are absolute. They must scroll inside this box, not widen the page. */}
					<div className="relative overflow-x-auto overflow-y-hidden pb-2.5">
						<p className="sr-only">{t("timetable.gridLabel")}</p>
						<div data-stagger="" className="cn-week">
							<span style={{ gridColumn: 1, gridRow: 1 }} />
							{TIMETABLE_DAYS.map((day, index) => (
								<span
									key={day.labelKey}
									style={{ gridColumn: index + 2, gridRow: 1 }}
									className="flex items-end gap-2 ps-1 pb-1 font-semibold text-[0.75rem] uppercase leading-none tracking-[0.14em]"
								>
									{t(day.labelKey)}
									<i className="font-normal text-[0.6875rem] text-muted-foreground not-italic tracking-normal">
										{day.date}
									</i>
								</span>
							))}
							{TIMETABLE_HOURS.map((hour, index) => (
								<span
									key={hour}
									style={{ gridColumn: 1, gridRow: index + 2 }}
									className="pt-2 text-end font-semibold text-[0.6875rem] text-muted-foreground tabular-nums leading-none tracking-[0.06em]"
								>
									{hour}
								</span>
							))}
							{TIMETABLE_CELLS.map((cell) => (
								<CourseBlock
									key={cell.id}
									cell={cell}
									size="week"
									slotLabel={slotLabel(cell)}
									style={{
										gridColumn: cell.day + 2,
										gridRow: `${cell.row + 2} / span ${cell.rowSpan}`,
									}}
								/>
							))}
						</div>
					</div>
				</div>
				<div className="mt-5.5 grid gap-x-[clamp(28px,4.5vw,72px)] gap-y-5 min-[820px]:grid-cols-2">
					<p className="max-w-[60ch] text-(--cn-ink-2) text-[0.875rem] leading-[1.6]">
						{t("timetable.noteOptional")}
					</p>
					<ul
						aria-label={t("timetable.roomsTitle")}
						className="grid grid-cols-1 border-foreground/12 border-t min-[480px]:grid-cols-2"
					>
						{rooms.map((room) => (
							<li
								key={room.name}
								className="flex flex-col gap-0.5 border-foreground/12 border-b py-2.5 pe-4 text-[0.875rem] leading-[1.45]"
							>
								<b className="font-display font-semibold">{room.name}</b>
								<span className="text-(--cn-ink-2)">{room.detail}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
