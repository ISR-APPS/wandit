// One block of the timetable: a course, or a free slot. TimetableSection and DayVignette render it.
// It reads the cell data of lib/timetable.ts. The fill of each course kind is in landing.css.
import type { CSSProperties } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { TimetableCell } from "../lib/timetable";

type CourseBlockProps = {
	cell: TimetableCell;
	/** "week": the full grid size. "day": the smaller vignette size of the hero. */
	size: "week" | "day";
	/** Grid placement in the week sheet. The vignette leaves it out. */
	style?: CSSProperties;
	/** Day and hour for screen readers, for example "Tue 10, 08:30". Only the week grid gives it. */
	slotLabel?: string;
};

/** A 14px block with the course name over its room line, or a hairline cell labelled "Free". */
export function CourseBlock({
	cell,
	size,
	style,
	slotLabel,
}: CourseBlockProps) {
	const { t } = useT();
	const isDay = size === "day";
	// The week grid is a flat list of divs, so a screen reader needs the day and the hour in each block.
	const slot = slotLabel !== undefined && (
		<span className="sr-only">{`${slotLabel}: `}</span>
	);
	if (cell.kind === "free") {
		return (
			<div
				data-cell={isDay ? undefined : ""}
				style={style}
				className={cn(
					"cn-r cn-course-free flex items-center justify-center border font-semibold text-[0.625rem] uppercase leading-none tracking-[0.14em]",
					isDay ? "min-h-16.5 flex-1" : "",
				)}
			>
				{slot}
				{t("timetable.free")}
			</div>
		);
	}
	return (
		<div
			data-cell={isDay ? undefined : ""}
			style={style}
			className={cn(
				"cn-r flex min-w-0 flex-col border",
				`cn-course-${cell.kind}`,
				isDay ? "min-h-16.5 flex-1 gap-1 px-3 py-2.5" : "gap-1.5 px-3 py-3",
			)}
		>
			{slot}
			<b
				className={cn(
					"font-display font-semibold leading-[1.15] tracking-[-0.012em]",
					isDay
						? "text-[0.875rem] min-[900px]:max-[1210px]:text-[0.8125rem]"
						: "text-[0.9375rem]",
				)}
			>
				{t(cell.titleKey)}
			</b>
			{/* In the 4-column vignette at 1024px, "3 h 15" breaks and leaves "15" alone on a line. */}
			<span
				className={cn(
					"mt-auto font-semibold text-[0.625rem] uppercase leading-[1.2] tracking-[0.11em] opacity-75",
					isDay && "whitespace-nowrap",
				)}
			>
				{t(cell.detailKey)}
			</span>
		</div>
	);
}
