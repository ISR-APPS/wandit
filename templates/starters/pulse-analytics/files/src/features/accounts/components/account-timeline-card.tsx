// The timeline card of the account page: the dated moments of the account, newest first.
// AccountDetailPage renders it with the milestones that the account query returns.
import {
	FlagIcon,
	LightningIcon,
	PlugsConnectedIcon,
	RocketLaunchIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
	calendarDaysAgo,
	fillMessage,
	formatRelativeTime,
	type MilestoneKind,
	type Plan,
	TOUCH_AREA,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { AccountMilestone } from "../api/accounts.queries";

/** The icon of each kind of milestone. */
const MILESTONE_ICON = {
	created: FlagIcon,
	upgraded: RocketLaunchIcon,
	people_reached: UsersThreeIcon,
	integration_connected: PlugsConnectedIcon,
	automation_created: LightningIcon,
} satisfies Record<MilestoneKind, KitIcon>;

/** How many moments the card shows before "Show all". With 4, the rail ends near the end of the main column. */
const SHORT_TIMELINE = 4;

/** A moment of the last 30 days also shows its distance from today. An older one shows only its date. */
const RELATIVE_TIME_DAYS = 30;

type AccountTimelineCardProps = {
	/** The milestones, newest first. */
	timeline: AccountMilestone[];
	/** The plan of the account. The "upgraded" milestone names it. */
	plan: Plan;
};

/** Each row: an icon on a line, one sentence, and the date. The card opens with the newest moments. */
export function AccountTimelineCard({
	timeline,
	plan,
}: AccountTimelineCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const now = Date.now();
	const [isExpanded, setIsExpanded] = useState(false);
	const shown = isExpanded ? timeline : timeline.slice(0, SHORT_TIMELINE);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.timeline.title")}</CardTitle>
			</CardHeader>
			<CardContent className="grid justify-items-start">
				<ol className="grid">
					{shown.map((milestone, index) => {
						const Icon = MILESTONE_ICON[milestone.kind];
						return (
							<li key={milestone.id} className="flex gap-3">
								<div className="flex flex-col items-center">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground">
										<Icon className="size-4" />
									</span>
									{/* The line joins this moment to the older one under it. */}
									{index < shown.length - 1 ? (
										<span
											aria-hidden="true"
											className="w-px flex-1 bg-border"
										/>
									) : null}
								</div>
								<div className="grid gap-0.5 pb-5">
									<p className="pt-1 font-medium text-sm">
										{fillMessage(
											t(`accounts.timeline.kinds.${milestone.kind}`),
											{
												person: milestone.personName ?? "",
												plan: t(`plans.${plan}`),
												count: number.format(milestone.peopleCount ?? 0),
											},
										)}
									</p>
									<p className="text-muted-foreground text-xs">
										{calendarDaysAgo(milestone.at, now) <= RELATIVE_TIME_DAYS
											? `${date.format(new Date(milestone.at))} · ${formatRelativeTime(milestone.at, now, locale)}`
											: date.format(new Date(milestone.at))}
									</p>
								</div>
							</li>
						);
					})}
				</ol>
				{timeline.length > SHORT_TIMELINE ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className={TOUCH_AREA}
						aria-expanded={isExpanded}
						onClick={() => setIsExpanded(!isExpanded)}
					>
						{isExpanded
							? t("accounts.timeline.showLess")
							: fillMessage(t("accounts.timeline.showAll"), {
									count: number.format(timeline.length),
								})}
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}
