// The run of show of one event: the timed plan of the day, from the load-in to the last line.
// EventDetailPage renders it in the main column. On the event day it marks the lines that passed and the one that runs now.

import {
	fillMessage,
	type ScheduleItem,
	timeFormat,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CheckIcon } from "~/shared/ui/icons";
import { scheduleLines } from "../lib/run-of-show";

type RunOfShowCardProps = {
	/** The lines of the run of show, in any order. */
	items: ScheduleItem[];
	/** The time of the load, in milliseconds since 1970. */
	now: number;
	/** True for a cancelled event: no line shows as done or now. */
	isCancelled: boolean;
};

/** A vertical timeline. The time column keeps one width, so the titles line up. */
export function RunOfShowCard({ items, now, isCancelled }: RunOfShowCardProps) {
	const { t, locale } = useT();
	const time = timeFormat(locale);
	// A cancelled event has no day: every line stays "upcoming", with no "next" ring.
	const lines = isCancelled
		? scheduleLines(items, 0).map((line) => ({
				...line,
				state: "upcoming" as const,
			}))
		: scheduleLines(items, now);
	const doneCount = lines.filter((line) => line.state === "done").length;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("events.runOfShow")}</CardTitle>
				<CardDescription>
					{isCancelled
						? t("events.runOfShowHintCancelled")
						: fillMessage(t("events.runOfShowHint"), {
								done: doneCount,
								total: lines.length,
							})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ol className="grid">
					{lines.map((line, index) => (
						<li
							key={line.id}
							className="grid grid-cols-[4.5rem_1.25rem_minmax(0,1fr)] gap-x-3"
						>
							<span
								className={cn(
									"pt-0.5 text-end text-sm tabular-nums",
									line.state === "done" && "text-muted-foreground",
								)}
							>
								{time.format(line.startsAt)}
							</span>
							<span className="relative flex justify-center">
								{/* The rail joins the marks. The last line has no rail under its mark. */}
								{index < lines.length - 1 ? (
									<span
										aria-hidden="true"
										className="absolute top-6 bottom-0 w-px bg-border"
									/>
								) : null}
								<span
									aria-hidden="true"
									className={cn(
										"relative mt-1 flex size-4 items-center justify-center rounded-full border",
										line.state === "done" &&
											"border-transparent bg-muted text-muted-foreground",
										line.state === "now" && "border-primary bg-primary",
										line.state === "next" && "border-primary",
										line.state === "upcoming" && "bg-card",
									)}
								>
									{line.state === "done" ? (
										<CheckIcon className="size-2.5" />
									) : null}
								</span>
							</span>
							<div className="grid gap-0.5 pb-5">
								<div className="flex flex-wrap items-center gap-2">
									<span
										className={cn(
											"font-medium text-sm",
											line.state === "done" && "text-muted-foreground",
										)}
										dir="auto"
									>
										{line.title}
									</span>
									{line.state === "now" ? (
										<Badge>{t("events.now")}</Badge>
									) : line.state === "next" && doneCount > 0 ? (
										<Badge variant="secondary">{t("events.next")}</Badge>
									) : null}
								</div>
								<span className="text-muted-foreground text-xs">
									<bdi>{line.area}</bdi>
									{" · "}
									<bdi>{line.owner}</bdi>
									{" · "}
									{fillMessage(t("events.minutes"), {
										count: line.durationMinutes,
									})}
								</span>
							</div>
						</li>
					))}
				</ol>
			</CardContent>
		</Card>
	);
}
