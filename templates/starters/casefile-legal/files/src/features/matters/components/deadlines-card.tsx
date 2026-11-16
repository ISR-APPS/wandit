// The upcoming deadlines of one matter: a date tile, the title, the kind, and the time left.
// MatterDetailPage renders it in the rail. A deadline within DEADLINE_SOON_DAYS shows in the warning color.
import {
	calendarDaysUntil,
	DEADLINE_SOON_DAYS,
	type DeadlineRow,
	formatRelativeTime,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type DeadlinesCardProps = {
	/** The future deadlines of the matter, soonest first. */
	deadlines: DeadlineRow[];
};

/** An empty list shows one muted sentence. A closed matter has no future deadline. */
export function DeadlinesCard({ deadlines }: DeadlinesCardProps) {
	const { t, locale } = useT();
	const month = new Intl.DateTimeFormat(locale, { month: "short" });
	const day = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const now = Date.now();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("matters.deadlines")}</CardTitle>
			</CardHeader>
			<CardContent>
				{deadlines.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("matters.noDeadlines")}
					</p>
				) : (
					<ul className="grid gap-4">
						{deadlines.map((deadline) => {
							const dueAt = new Date(deadline.dueAt);
							const isSoon =
								calendarDaysUntil(deadline.dueAt, now) <= DEADLINE_SOON_DAYS;
							return (
								<li key={deadline.id} className="flex items-start gap-3">
									<span
										className={cn(
											"grid w-11 shrink-0 justify-items-center rounded-control border py-1 leading-tight",
											isSoon && "border-warning/40 bg-warning/10",
										)}
									>
										<span className="text-muted-foreground text-xs">
											{month.format(dueAt)}
										</span>
										<span className="font-numeric font-semibold text-base tabular-nums">
											{day.format(dueAt)}
										</span>
									</span>
									<span className="grid min-w-0 gap-0.5 text-sm">
										<span className="font-medium" dir="auto">
											{deadline.title}
										</span>
										<span className="text-muted-foreground text-xs">
											{t(`deadlineKinds.${deadline.kind}`)}
											{deadline.kind === "filing"
												? null
												: ` · ${time.format(dueAt)}`}
										</span>
										<span
											className={cn(
												"text-xs",
												isSoon
													? "font-medium text-warning"
													: "text-muted-foreground",
											)}
										>
											{formatRelativeTime(deadline.dueAt, now, locale)}
										</span>
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
