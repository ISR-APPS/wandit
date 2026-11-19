// The check-in timeline of the member page: the newest visits on a line, with the class, the coach, and the room.
// MemberDetailPage renders it at the top of the main column. "View all" opens the Visits tab of the page.
// It follows the latest activity card of the kit profile page and the line timeline of the kit system.
import { BarbellIcon, ClockIcon } from "@phosphor-icons/react";
import { formatRelativeTime } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { VisitRow } from "../lib/member-rows";

// Four visits keep the card near the height of the profile card.
const SHOWN_VISITS = 4;

type MemberTimelineCardProps = {
	/** Every visit of the member, newest first. */
	visits: VisitRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
	/** Opens the Visits tab with the full list. */
	onViewAll: () => void;
};

/** The newest visit gets the filled dot and a "Latest" badge. */
export function MemberTimelineCard({
	visits,
	now,
	onViewAll,
}: MemberTimelineCardProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("members.timelineTitle")}</CardTitle>
				{visits.length > SHOWN_VISITS ? (
					<CardAction>
						<Button type="button" variant="ghost" size="sm" onClick={onViewAll}>
							{t("common.viewAll")}
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent>
				{visits.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("members.noVisits")}
					</p>
				) : (
					<ol className="relative ms-2 grid gap-6 border-s ps-6">
						{visits.slice(0, SHOWN_VISITS).map((visit, index) => (
							<li key={visit.id} className="relative grid gap-1">
								<span
									aria-hidden="true"
									className={cn(
										"absolute -start-9 top-0 flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground",
										index === 0 &&
											"border-primary bg-primary text-primary-foreground",
									)}
								>
									<BarbellIcon className="size-3.5" />
								</span>
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-medium text-sm">
										{visit.className ?? t("members.openGym")}
									</span>
									{index === 0 ? (
										<Badge variant="outline">{t("members.latest")}</Badge>
									) : null}
								</div>
								<span className="flex items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
									<ClockIcon className="size-3.5" />
									{`${dateTime.format(visit.at)} · ${formatRelativeTime(visit.at, now, locale)}`}
								</span>
								<p className="text-muted-foreground text-sm">
									{visit.coachName === null
										? t("members.openGymDetail")
										: `${visit.coachName} · ${visit.studio ?? ""}`}
								</p>
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
