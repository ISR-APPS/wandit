// The second card of the middle grid: the three next deadlines of the firm, each in a box.
// DashboardPage renders it. The /app loader fills the upcoming deadlines.
// It follows recipe 3.4 of the kit system: a status icon, the title, the matter, a priority badge, and the due text.
// The deadlines are read only here, so the icon is not a checkbox. "All matters" opens the matter list.
import {
	ArrowRightIcon,
	CircleIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	deadlinePriority,
	formatRelativeTime,
	PriorityBadge,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { upcomingDeadlinesQueryOptions } from "../api/dashboard.queries";

// Three boxes keep the card as tall as the donut card beside it, as in the kit.
const SHOWN_DEADLINES = 3;

type DeadlinesCardProps = {
	/** The current time in milliseconds since 1970. The priorities and the due texts count from it. */
	now: number;
};

/** The query sorts the soonest deadline first, so the first three rows are the most urgent. */
export function DeadlinesCard({ now }: DeadlinesCardProps) {
	const { t, locale } = useT();
	const { data: deadlines } = useSuspenseQuery(upcomingDeadlinesQueryOptions());

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.deadlinesTitle")}</CardTitle>
				<CardDescription>{t("dashboard.deadlinesDescription")}</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/matters">
							{t("dashboard.allMatters")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid content-start gap-3">
				{deadlines.length === 0 ? (
					<p className="py-10 text-center text-muted-foreground text-sm">
						{t("dashboard.noDeadlines")}
					</p>
				) : (
					deadlines.slice(0, SHOWN_DEADLINES).map((deadline) => {
						const priority = deadlinePriority(deadline.dueAt, now);
						const StateIcon =
							priority === "high" ? WarningCircleIcon : CircleIcon;
						return (
							<div
								key={deadline.id}
								className="flex items-start gap-3 rounded-md border p-3"
							>
								<StateIcon
									className={cn(
										"mt-0.5 size-4 shrink-0",
										priority === "high"
											? "text-destructive"
											: "text-muted-foreground",
									)}
								/>
								<div className="grid min-w-0 gap-1">
									<p className="font-medium text-sm leading-snug">
										{deadline.title}
									</p>
									<Link
										to="/app/matters/$matterId"
										params={{ matterId: deadline.matterId }}
										className="text-muted-foreground text-xs hover:text-foreground hover:underline"
										dir="auto"
									>
										{`${deadline.matterName} · ${deadline.clientName}`}
									</Link>
									<div className="flex flex-wrap items-center gap-2 pt-1">
										<PriorityBadge priority={priority} />
										<span className="text-muted-foreground text-xs">
											{`${t(`deadlineKinds.${deadline.kind}`)} · ${formatRelativeTime(deadline.dueAt, now, locale)}`}
										</span>
									</div>
								</div>
							</div>
						);
					})
				)}
			</CardContent>
		</Card>
	);
}
