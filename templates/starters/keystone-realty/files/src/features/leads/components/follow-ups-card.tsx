// The follow-up card of the leads page, in a task-list layout: the three most urgent
// next actions on open leads, each in a box with a state icon, the lead, a priority badge, and the wait.
// LeadsPage renders it in the middle row. A lead name opens the lead panel. The header button filters the table.
import { CircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { formatWaitingTime, type LeadStatus } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge, type badgeVariants } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { describeInterest } from "../lib/lead-interest";
import type { FollowUp, FollowUpPriority } from "../lib/lead-stats";

// Three boxes keep the card as tall as the donut card beside it.
const SHOWN_FOLLOW_UPS = 3;

// The badge look per priority. High has no tinted variant, so it uses the tint recipe of the success variant.
const PRIORITY_BADGE = {
	high: {
		variant: "outline",
		className: "border-destructive/25 bg-destructive/12 text-destructive",
	},
	medium: { variant: "warning", className: "" },
	low: { variant: "success", className: "" },
} satisfies Record<
	FollowUpPriority,
	{ variant: VariantProps<typeof badgeVariants>["variant"]; className: string }
>;

type FollowUpsCardProps = {
	/** Every open follow-up, the most urgent first. The card shows the first three. */
	followUps: FollowUp[];
	/** The current time in milliseconds since 1970. The wait counts from it. */
	now: number;
	/** The status of the table filter now. The lead links keep it. */
	statusFilter: LeadStatus | undefined;
	/** Sets the status filter of the table to "new", so the table lists every lead with no answer. */
	onShowNew: () => void;
};

/** A high priority shows a warning icon, so the color is never the only mark. */
export function FollowUpsCard({
	followUps,
	now,
	statusFilter,
	onShowNew,
}: FollowUpsCardProps) {
	const { t, locale } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("leads.followUps.title")}</CardTitle>
				<CardDescription>{t("leads.followUps.description")}</CardDescription>
				<CardAction>
					<Button type="button" variant="outline" size="sm" onClick={onShowNew}>
						{t("leads.followUps.showNew")}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid content-start gap-3">
				{followUps.length === 0 ? (
					<p className="py-10 text-center text-muted-foreground text-sm">
						{t("leads.followUps.empty")}
					</p>
				) : (
					followUps.slice(0, SHOWN_FOLLOW_UPS).map((followUp) => {
						const isHigh = followUp.priority === "high";
						const StateIcon = isHigh ? WarningCircleIcon : CircleIcon;
						const look = PRIORITY_BADGE[followUp.priority];
						return (
							<div
								key={followUp.lead.id}
								className="flex items-start gap-3 rounded-md border p-3"
							>
								<StateIcon
									className={cn(
										"mt-0.5 size-4 shrink-0",
										isHigh ? "text-destructive" : "text-muted-foreground",
									)}
								/>
								<div className="grid min-w-0 gap-1">
									<p className="font-medium text-sm leading-none">
										{t(`leads.followUps.actions.${followUp.action}`)}
									</p>
									<Link
										to="/app/leads"
										search={{ status: statusFilter, lead: followUp.lead.id }}
										className="truncate text-muted-foreground text-xs hover:text-foreground hover:underline"
										dir="auto"
									>
										{`${followUp.lead.fullName} · ${describeInterest(followUp.lead, t)}`}
									</Link>
									<div className="flex flex-wrap items-center gap-2 pt-1">
										<Badge variant={look.variant} className={look.className}>
											{t(`leads.priorities.${followUp.priority}`)}
										</Badge>
										<span className="text-muted-foreground text-xs">
											{formatWaitingTime(followUp.since, now, locale)}
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
