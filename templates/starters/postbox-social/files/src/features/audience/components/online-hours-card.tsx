// A heat grid of the hours when followers are online: 7 days (Monday first) by 8 blocks of 3 hours.
// AudiencePage renders it in the last row. The grid is one image for screen readers: its label names the peak block.
import { fillMessage } from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { HOUR_BLOCKS } from "../lib/sample-data";

type OnlineHoursCardProps = {
	/** 7 rows (Monday first) of 8 levels from 0 to 1, where 1 is the busiest block. */
	levels: number[][];
};

// Five steps of the primary color, from quiet to busy. Tailwind needs each class as a full literal.
const STEPS = [
	"bg-primary/8",
	"bg-primary/25",
	"bg-primary/45",
	"bg-primary/70",
	"bg-primary",
] as const;

// The step of a level: 0 to 0.2 is the first step, 0.8 to 1 the last.
function stepOf(level: number): string {
	return (
		STEPS[Math.min(STEPS.length - 1, Math.floor(level * STEPS.length))] ?? ""
	);
}

// 4 January 2021 is a Monday. The grid rows start on Monday, so day index 0 maps to it.
const FIRST_MONDAY = new Date(2021, 0, 4);

/** The hour labels show every second block, so they fit at 375 px. The label of a block starts at its start edge. */
export function OnlineHoursCard({ levels }: OnlineHoursCardProps) {
	const { t, locale } = useT();
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const longWeekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
	const hour = new Intl.DateTimeFormat(locale, { hour: "numeric" });
	const dayDate = (index: number) =>
		new Date(
			FIRST_MONDAY.getFullYear(),
			FIRST_MONDAY.getMonth(),
			FIRST_MONDAY.getDate() + index,
		);
	const hourLabel = (startHour: number) =>
		hour.format(new Date(2021, 0, 4, startHour));
	let peakDay = 0;
	let peakBlock = 0;
	levels.forEach((row, dayIndex) => {
		row.forEach((level, blockIndex) => {
			if (level > (levels[peakDay]?.[peakBlock] ?? 0)) {
				peakDay = dayIndex;
				peakBlock = blockIndex;
			}
		});
	});
	const peakStart = HOUR_BLOCKS[peakBlock] ?? 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("audience.hoursTitle")}</CardTitle>
				<CardDescription>{t("audience.hoursDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div
					role="img"
					aria-label={fillMessage(t("audience.hoursPeak"), {
						day: longWeekday.format(dayDate(peakDay)),
						hours: `${hourLabel(peakStart)}–${hourLabel((peakStart + 3) % 24)}`,
					})}
					className="grid grid-cols-[2.5rem_repeat(8,minmax(0,1fr))] gap-1"
				>
					{levels.map((row, dayIndex) => (
						<div key={weekday.format(dayDate(dayIndex))} className="contents">
							<span className="self-center text-muted-foreground text-xs">
								{weekday.format(dayDate(dayIndex))}
							</span>
							{row.map((level, blockIndex) => (
								<span
									key={HOUR_BLOCKS[blockIndex]}
									className={cn("h-7 rounded-sm", stepOf(level))}
								/>
							))}
						</div>
					))}
					<span />
					{/* Each label marks the start of a block and spans two blocks, so it stays on one line. */}
					{HOUR_BLOCKS.filter((_, index) => index % 2 === 0).map(
						(startHour) => (
							<span
								key={startHour}
								className="col-span-2 whitespace-nowrap text-muted-foreground text-xs tabular-nums"
							>
								{hourLabel(startHour)}
							</span>
						),
					)}
				</div>
				<div className="flex items-center justify-end gap-2 text-muted-foreground text-xs">
					<span>{t("audience.hoursLegendLow")}</span>
					{STEPS.map((step) => (
						<span key={step} className={cn("size-3 rounded-sm", step)} />
					))}
					<span>{t("audience.hoursLegendHigh")}</span>
				</div>
			</CardContent>
		</Card>
	);
}
