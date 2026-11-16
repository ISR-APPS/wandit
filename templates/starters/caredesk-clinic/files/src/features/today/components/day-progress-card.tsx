// The progress of today on the home page: the visits done of all appointments, then where the other patients are.
// TodayPage renders it with the counts of buildDayProgress.
// The six counts add up to the total, so the panel agrees with the agenda and the appointments page.
import { fillMessage } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { DayProgress } from "../lib/series";

type DayProgressCardProps = {
	/** The counts of the appointments of today, from buildDayProgress. */
	progress: DayProgress;
	/** The grid span of the home page. */
	className?: string;
};

/** A meter of a real whole: the visits done of the appointments that nobody cancelled. */
export function DayProgressCard({ progress, className }: DayProgressCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	// Each place has a word and a mark. The mark color repeats the status badge of the agenda.
	const places = [
		{
			id: "inConsultation",
			label: t("today.inConsultation"),
			count: progress.inConsultation,
			mark: "bg-primary",
		},
		{
			id: "waiting",
			label: t("today.waiting"),
			count: progress.waiting,
			mark: "bg-info",
		},
		{
			id: "late",
			label: t("today.late"),
			count: progress.late,
			mark: "bg-warning",
		},
		{
			id: "toCome",
			label: t("today.toCome"),
			count: progress.toCome,
			mark: "bg-muted-foreground/40",
		},
	];
	const closedNotes = [
		progress.noShows > 0
			? fillMessage(t("today.noShowCount"), {
					count: number.format(progress.noShows),
				})
			: null,
		progress.cancelled > 0
			? fillMessage(t("today.cancelledCount"), {
					count: number.format(progress.cancelled),
				})
			: null,
	].filter((note) => note !== null);

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("today.progress")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				<div className="grid gap-2">
					<p className="flex items-baseline gap-2">
						<span className="font-numeric font-semibold text-5xl tabular-nums leading-none">
							{number.format(progress.seen)}
						</span>
						<span className="text-muted-foreground text-sm tabular-nums">
							{fillMessage(t("today.seenOfTotal"), {
								total: number.format(progress.total),
							})}
						</span>
					</p>
					{/* The brand color keeps the meter in the theme. Primary on its 15% tint stays above 3:1. */}
					<Progress
						className="bg-primary/15 [&>[data-slot=progress-indicator]]:bg-primary"
						value={progress.seen}
						max={progress.total}
						aria-label={t("today.progress")}
					/>
				</div>
				<dl className="grid divide-y border-t">
					{places.map((place) => (
						<div
							key={place.id}
							className="flex items-center justify-between gap-2 py-2.5 text-sm"
						>
							<dt className="flex min-w-0 items-center gap-2.5">
								<span
									className={cn("size-2 shrink-0 rounded-full", place.mark)}
								/>
								<span className="truncate">{place.label}</span>
							</dt>
							<dd className="font-medium font-numeric tabular-nums">
								{number.format(place.count)}
							</dd>
						</div>
					))}
				</dl>
				{closedNotes.length > 0 ? (
					<p className="text-muted-foreground text-xs tabular-nums">
						{closedNotes.join(" · ")}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
