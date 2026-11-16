// The progress of the day on the housekeeping page: the whole team, then one meter per attendant.
// HousekeepingPage renders it over the board. Each figure is a share of a count of all tasks (the meter form).
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { Workload } from "../lib/task-board";

// One decimal rounds 0.9996 up to "100%". A value under its whole stops at 99.9 %.
const MAX_SHARE_UNDER_WHOLE = 0.999;

type WorkloadCardProps = {
	/** One entry per attendant, from workloadPerAttendant(). The first figure adds them. */
	workloads: Workload[];
};

/** One Card with a figure for the team and one per attendant. 2 columns at 375 px, 5 on a wide screen. */
export function WorkloadCard({ workloads }: WorkloadCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const figures = [
		{
			id: "team",
			label: t("housekeeping.allTasks"),
			caption: t("housekeeping.team"),
			done: workloads.reduce((sum, item) => sum + item.done, 0),
			total: workloads.reduce((sum, item) => sum + item.total, 0),
		},
		...workloads.map((item) => ({
			id: item.attendant.id,
			label: item.attendant.fullName,
			caption:
				item.attendant.floor === null
					? t("housekeeping.evening")
					: t(`floors.floor${item.attendant.floor}`),
			done: item.done,
			total: item.total,
		})),
	];

	return (
		<Card>
			<CardContent className="grid @3xl/main:grid-cols-5 grid-cols-2 gap-x-6 gap-y-6">
				{figures.map((figure, index) => (
					<div
						key={figure.id}
						// The team figure takes the full first row at 375 px.
						className={
							index === 0
								? "@3xl/main:col-span-1 col-span-2 grid content-start gap-2"
								: "grid content-start gap-2"
						}
					>
						<div className="grid">
							<p className="label-text truncate text-sm" dir="auto">
								{figure.label}
							</p>
							<p className="text-muted-foreground text-xs">{figure.caption}</p>
						</div>
						<p className="font-numeric text-3xl tabular-nums leading-none">
							{number.format(figure.done)}
							<span className="text-lg text-muted-foreground">
								{` / ${number.format(figure.total)}`}
							</span>
						</p>
						<Progress
							value={figure.done}
							max={figure.total}
							aria-label={figure.label}
						/>
						<p className="text-muted-foreground text-sm">
							{figure.total > 0 ? (
								<>
									<bdi dir="ltr" className="tabular-nums">
										{share.format(
											figure.done < figure.total
												? Math.min(
														figure.done / figure.total,
														MAX_SHARE_UNDER_WHOLE,
													)
												: 1,
										)}
									</bdi>
									{` ${t("housekeeping.doneShare")}`}
								</>
							) : (
								t("housekeeping.noTask")
							)}
						</p>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
