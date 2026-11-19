// The reminders card of the home: the next three viewings, each in a box with a date tile,
// the home, the lead and the agent, and their initials. OverviewPage renders it under the sales progress.
// The dots menu links to the viewings calendar and to the leads.
import { DotsThreeIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { fillMessage, PersonAvatar, type ViewingRow } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";

type RemindersCardProps = {
	/** The viewings to come, by start time, at most 3. */
	viewings: ViewingRow[];
};

/** No viewing to come: one sentence and the link to the calendar. */
export function RemindersCard({ viewings }: RemindersCardProps) {
	const { t, locale } = useT();
	const month = new Intl.DateTimeFormat(locale, { month: "short" });
	const day = new Intl.DateTimeFormat(locale, { day: "2-digit" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.reminders.title")}</CardTitle>
				<CardAction>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8"
								aria-label={t("overview.reminders.menu")}
							>
								<DotsThreeIcon className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem asChild>
								<Link to="/app/viewings">
									{t("overview.reminders.openCalendar")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to="/app/leads">{t("overview.reminders.openLeads")}</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				{viewings.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{t("overview.reminders.empty")}
					</p>
				) : (
					viewings.map((viewing) => {
						const startsAt = new Date(viewing.startsAt);
						return (
							<div
								key={viewing.id}
								className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3"
							>
								<div className="min-w-16 rounded-lg border bg-background px-3 py-2 text-center">
									<p className="text-muted-foreground text-xs leading-none">
										{month.format(startsAt)}
									</p>
									<p className="mt-1 font-numeric font-semibold text-xl tabular-nums leading-none">
										{day.format(startsAt)}
									</p>
								</div>
								<div className="grid min-w-0 flex-1 gap-1">
									<Link
										to="/app/listings/$listingId"
										params={{ listingId: viewing.listingId }}
										className="truncate font-semibold leading-tight hover:underline"
										dir="auto"
									>
										{fillMessage(t("overview.reminders.viewingAt"), {
											home: viewing.listingStreet,
										})}
									</Link>
									<p className="truncate text-muted-foreground text-sm">
										{fillMessage(t("overview.reminders.detail"), {
											lead: viewing.leadName,
											agent: viewing.agentName,
											time: time.format(startsAt),
										})}
									</p>
								</div>
								<div className="flex -space-x-2">
									<PersonAvatar
										fullName={viewing.agentName}
										className="size-9 ring-2 ring-card"
									/>
									<PersonAvatar
										fullName={viewing.leadName}
										className="size-9 ring-2 ring-card"
									/>
								</div>
							</div>
						);
					})
				)}
			</CardContent>
		</Card>
	);
}
