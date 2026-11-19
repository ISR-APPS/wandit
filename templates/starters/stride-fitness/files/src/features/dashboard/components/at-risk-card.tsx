// The at-risk card of the home: the active members with no visit for two weeks, the longest gone first.
// DashboardPage renders it in the second row. "View all" opens the members page with the "At risk" filter.
// It follows recipe 3.5 of the kit system (an activity feed) and the friends card of the kit fitness page.
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	AT_RISK_DAYS,
	dayCountFormat,
	fillMessage,
	formatRelativeTime,
	MemberAvatar,
} from "~/features/gym";
import type { MemberRow } from "~/features/members";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// Seven rows keep the card as high as the classes card beside it.
const SHOWN_MEMBERS = 7;

type AtRiskCardProps = {
	/** The at-risk members, the longest gone first. */
	members: MemberRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

/** The time at the end is the last visit. A member who never came shows "never". */
export function AtRiskCard({ members, now }: AtRiskCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.atRiskTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("dashboard.atRiskDescription"), {
						count: number.format(members.length),
						period: dayCountFormat(locale).format(AT_RISK_DAYS),
					})}
				</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/members" search={{ visits: "atRisk" }}>
							{t("common.viewAll")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{members.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("dashboard.noAtRisk")}
					</p>
				) : (
					<ul className="grid gap-4">
						{members.slice(0, SHOWN_MEMBERS).map((member) => (
							<li key={member.id} className="flex items-center gap-3">
								<MemberAvatar name={member.fullName} className="size-9" />
								<div className="grid min-w-0 flex-1">
									<Link
										to="/app/members/$memberId"
										params={{ memberId: member.id }}
										className="truncate font-medium text-sm hover:underline"
									>
										{member.fullName}
									</Link>
									<span className="text-pretty text-muted-foreground text-xs">
										{fillMessage(t("dashboard.usualVisits"), {
											plan: member.planName,
											count: number.format(member.weeklyVisits),
										})}
									</span>
								</div>
								<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
									{member.lastVisitAt === null
										? t("members.never")
										: formatRelativeTime(member.lastVisitAt, now, locale)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
