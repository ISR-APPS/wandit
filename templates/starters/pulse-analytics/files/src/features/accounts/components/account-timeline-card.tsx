// The timeline card of the account page: the milestones of the account on a line, the newest first.
// Each step has an icon dot, a title, the date, and one sentence. The newest step has a "Latest" badge and a link to the events.
// AccountOverview renders the 3 newest steps with "View all"; the Timeline tab renders every step.
import {
	ArrowsClockwiseIcon,
	ClockIcon,
	LightningIcon,
	PlugsConnectedIcon,
	RocketLaunchIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	type MilestoneKind,
	type Plan,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { AccountMilestone } from "../api/accounts.queries";

/** The icon of each kind of milestone. The title always names the kind too. */
const MILESTONE_ICONS = {
	created: RocketLaunchIcon,
	upgraded: ArrowsClockwiseIcon,
	people_reached: UsersThreeIcon,
	integration_connected: PlugsConnectedIcon,
	automation_created: LightningIcon,
} satisfies Record<MilestoneKind, KitIcon>;

type AccountTimelineCardProps = {
	/** The milestones, the newest first. */
	timeline: AccountMilestone[];
	/** The current plan: the "upgraded" step names it. */
	plan: Plan;
	/** How many steps show. Every step shows when absent. */
	limit?: number;
	/** Opens the Timeline tab. The "View all" button shows only with it, and only when steps are hidden. */
	onViewAll?: () => void;
};

/** The line is the start border of the list. Each dot sits on it. */
export function AccountTimelineCard({
	timeline,
	plan,
	limit,
	onViewAll,
}: AccountTimelineCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const number = new Intl.NumberFormat(locale);
	const shown = limit === undefined ? timeline : timeline.slice(0, limit);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.timeline.title")}</CardTitle>
				{onViewAll && shown.length < timeline.length ? (
					<CardAction>
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto p-0 text-muted-foreground"
							onClick={onViewAll}
						>
							{t("accounts.timeline.viewAll")}
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="ps-8">
				<ol className="relative grid gap-10 border-s">
					{shown.map((milestone, index) => {
						const Icon = MILESTONE_ICONS[milestone.kind];
						const values = {
							person: milestone.personName ?? "",
							plan: t(`plans.${plan}`),
							count: number.format(milestone.peopleCount ?? 0),
						};
						return (
							<li key={milestone.id} className="ms-6 grid gap-2">
								<span className="absolute -start-3 flex size-6 items-center justify-center rounded-full border bg-muted">
									<Icon className="size-3 text-primary" />
								</span>
								<h3 className="flex flex-wrap items-center gap-2 font-semibold">
									{fillMessage(
										t(`accounts.timeline.kinds.${milestone.kind}`),
										values,
									)}
									{index === 0 ? (
										<Badge variant="outline">
											{t("accounts.timeline.latest")}
										</Badge>
									) : null}
								</h3>
								<time
									dateTime={milestone.at}
									className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none"
								>
									<ClockIcon className="size-3" />
									{date.format(new Date(milestone.at))}
								</time>
								<p className="text-muted-foreground text-sm">
									{fillMessage(
										t(`accounts.timeline.details.${milestone.kind}`),
										values,
									)}
								</p>
								{index === 0 ? (
									<Button
										variant="outline"
										className="justify-self-start"
										asChild
									>
										<Link to="/app/events">
											{t("accounts.timeline.openEvents")}
										</Link>
									</Button>
								) : null}
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}
