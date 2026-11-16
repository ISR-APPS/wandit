// The breakdown panel of the home: tickets received by topic in the last DEFAULT_DAYS days, the largest first.
// QueuePage renders it beside the Solved panel. Each row has the step square of the heat scale, a share bar, the count,
// and the open and late tickets of the topic now, so the breakdown points back to the queue.
import { fillMessage } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { HEAT_STEPS, heatStep } from "../lib/heat-steps";

/** One translated row of the breakdown. */
export type TopicSlice = {
	/** The topic code, also the React key. */
	id: string;
	/** The translated topic name. */
	label: string;
	/** Tickets received with this topic in the period. */
	value: number;
	/** Open tickets of this topic now, from the queue list. Not limited to the period. */
	open: number;
	/** The open tickets of this topic that passed their SLA deadline. */
	late: number;
};

type TopicBreakdownCardProps = {
	slices: TopicSlice[];
	/** The length of the period, in days. */
	days: number;
};

/** Ranked rows in the order of the data. A total of 0 keeps the panel and shows one muted sentence. */
export function TopicBreakdownCard({ slices, days }: TopicBreakdownCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const max = Math.max(0, ...slices.map((slice) => slice.value));
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("chart.topicsTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("chart.topicsDescription"), {
						total: number.format(total),
						days: number.format(days),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{total === 0 ? (
					<p className="py-10 text-center text-muted-foreground text-sm">
						{t("chart.empty")}
					</p>
				) : (
					// Equal rows fill the card, so it ends level with the Solved panel beside it and leaves no empty band.
					<ul className="grid flex-1 auto-rows-fr">
						{slices.map((slice) => (
							<li
								key={slice.id}
								className="grid content-center gap-2 border-t py-3 first:border-t-0 first:pt-0"
							>
								<div className="flex items-center gap-3 text-sm">
									<span
										aria-hidden="true"
										className={cn(
											"size-3 shrink-0 rounded-xs",
											HEAT_STEPS[heatStep(slice.value, max)],
										)}
									/>
									<span className="min-w-0 flex-1 truncate">{slice.label}</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{percent.format(slice.value / total)}
									</span>
									<span className="w-10 text-end font-medium tabular-nums">
										{number.format(slice.value)}
									</span>
								</div>
								<div className="h-1.5 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-chart-1"
										style={{ width: `${(slice.value / max) * 100}%` }}
									/>
								</div>
								<p className="text-muted-foreground text-xs tabular-nums">
									{slice.open === 0
										? t("chart.topicNothingOpen")
										: fillMessage(t("chart.topicOpen"), {
												open: number.format(slice.open),
											})}
									{slice.late > 0 ? (
										<span className="text-destructive">
											{` · ${fillMessage(t("chart.topicLate"), {
												late: number.format(slice.late),
											})}`}
										</span>
									) : null}
								</p>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
