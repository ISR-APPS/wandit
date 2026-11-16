// A vertical timeline of logged activities: an icon per kind, the subject, the note, and who logged it.
// The deal page shows the activities of the deal with it. The contact panel shows the last activities of a person.
import { Link } from "@tanstack/react-router";
import { ACTIVITY_TYPE_ICON, formatRelativeTime } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Activity } from "../api/activities.queries";

type ActivityTimelineProps = {
	/** The activities to show, newest first. */
	activities: Activity[];
	/** The current time in milliseconds since 1970. The relative times count from it. */
	now: number;
	/** True adds a link to the deal of each activity. The deal page leaves it off. */
	showDeal?: boolean;
};

/** One row per activity, joined by a line. The caller handles the empty list. */
export function ActivityTimeline({
	activities,
	now,
	showDeal = false,
}: ActivityTimelineProps) {
	const { t, locale } = useT();
	return (
		<ol className="grid">
			{activities.map((activity, index) => {
				const TypeIcon = ACTIVITY_TYPE_ICON[activity.type];
				const isLast = index === activities.length - 1;
				return (
					<li key={activity.id} className="grid grid-cols-[auto_1fr] gap-x-3">
						<div className="flex flex-col items-center">
							<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
								<TypeIcon className="size-4" />
							</span>
							{isLast ? null : <span className="w-px flex-1 bg-border" />}
						</div>
						<div className={cn("grid min-w-0 gap-1", isLast ? "pb-0" : "pb-5")}>
							<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pt-1">
								<p className="font-medium text-sm">{activity.subject}</p>
								<time
									dateTime={activity.occurredAt}
									className="text-muted-foreground text-xs"
								>
									{formatRelativeTime(activity.occurredAt, now, locale)}
								</time>
							</div>
							<p className="text-muted-foreground text-sm" dir="auto">
								{activity.note}
							</p>
							<p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs">
								<span>{t(`activityTypes.${activity.type}`)}</span>
								<span aria-hidden="true">·</span>
								<bdi>{activity.repName}</bdi>
								{showDeal && activity.deal ? (
									<>
										<span aria-hidden="true">·</span>
										<Link
											to="/app/deals/$dealId"
											params={{ dealId: activity.deal.id }}
											className="text-foreground underline decoration-border underline-offset-4 hover:decoration-ring"
										>
											{activity.deal.name}
										</Link>
									</>
								) : null}
							</p>
						</div>
					</li>
				);
			})}
		</ol>
	);
}
